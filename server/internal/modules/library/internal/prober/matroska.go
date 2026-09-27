package prober

import (
	"encoding/binary"
	"io"
	"math"
	"time"
)

// Matroska is EBML: a tree of elements, each "id, size, body", where both the id
// and the size are variable-length integers. Two elements answer the question —
// Info/TimecodeScale, how many nanoseconds one tick is, and Info/Duration, the
// length in ticks — and Info is written before the first frame in every file a
// player is expected to seek in.
const (
	idSegment       = 0x18538067
	idInfo          = 0x1549A966
	idTimecodeScale = 0x2AD7B1
	idDuration      = 0x4489

	// What the spec says a tick is when the file does not say: one millisecond.
	defaultTimecodeScale = 1_000_000
)

func matroskaDuration(reader io.ReadSeeker, size int64) (time.Duration, error) {
	limit := min(size, maxHeaderBytes)

	segment, err := findEBMLElement(reader, 0, limit, idSegment)
	if err != nil {
		return 0, err
	}

	info, err := findEBMLElement(reader, segment.body, min(segment.end, limit), idInfo)
	if err != nil {
		return 0, err
	}

	return readSegmentInfo(reader, info)
}

type ebmlElement struct {
	body int64
	end  int64
}

// findEBMLElement scans one level of the tree. It does not descend: every
// element this prober wants sits directly under the one it was found in.
func findEBMLElement(reader io.ReadSeeker, from, until int64, want uint64) (ebmlElement, error) {
	for offset := from; offset < until; {
		if _, err := reader.Seek(offset, io.SeekStart); err != nil {
			return ebmlElement{}, err
		}

		id, idLength, err := readVarInt(reader, true)
		if err != nil {
			return ebmlElement{}, err
		}

		length, sizeLength, err := readVarInt(reader, false)
		if err != nil {
			return ebmlElement{}, err
		}

		body := offset + int64(idLength) + int64(sizeLength)

		// A live recording writes the segment before it knows how long it is and
		// says so with an all-ones size. Its children still have real sizes.
		end := until
		if !unknownLength(length, sizeLength) {
			end = min(body+signed(length), until)
		}

		if id == want {
			return ebmlElement{body: body, end: end}, nil
		}

		if end <= offset {
			return ebmlElement{}, errNotFound
		}

		offset = end
	}

	return ebmlElement{}, errNotFound
}

func readSegmentInfo(reader io.ReadSeeker, info ebmlElement) (time.Duration, error) {
	scale := uint64(defaultTimecodeScale)
	ticks := math.NaN()

	for offset := info.body; offset < info.end; {
		if _, err := reader.Seek(offset, io.SeekStart); err != nil {
			return 0, err
		}

		id, idLength, err := readVarInt(reader, true)
		if err != nil {
			return 0, err
		}

		length, sizeLength, err := readVarInt(reader, false)
		if err != nil {
			return 0, err
		}

		body := offset + int64(idLength) + int64(sizeLength)
		if unknownLength(length, sizeLength) || body+signed(length) > info.end {
			return 0, errNotFound
		}

		payload := make([]byte, length)
		if _, err := io.ReadFull(reader, payload); err != nil {
			return 0, err
		}

		switch id {
		case idTimecodeScale:
			if value := unsigned(payload); value > 0 {
				scale = value
			}

		case idDuration:
			value, err := floating(payload)
			if err != nil {
				return 0, err
			}

			ticks = value
		}

		offset = body + signed(length)
	}

	if math.IsNaN(ticks) || ticks <= 0 {
		return 0, errNotFound
	}

	return time.Duration(ticks * float64(scale)), nil
}

// readVarInt reads an EBML variable-length integer. The first set bit of the
// first byte says how many bytes the number takes; for an id that marker is part
// of the value, for a size it is not.
func readVarInt(reader io.Reader, keepMarker bool) (value uint64, width int, err error) {
	first := make([]byte, 1)
	if _, err = io.ReadFull(reader, first); err != nil {
		return 0, 0, err
	}

	if first[0] == 0 {
		return 0, 0, errNotFound
	}

	width = 1
	for mask := byte(0x80); first[0]&mask == 0; mask >>= 1 {
		width++
	}

	value = uint64(first[0])
	if !keepMarker {
		value &^= uint64(1) << (8 - width)
	}

	if width > 1 {
		rest := make([]byte, width-1)
		if _, err = io.ReadFull(reader, rest); err != nil {
			return 0, 0, err
		}

		for _, b := range rest {
			value = value<<8 | uint64(b)
		}
	}

	return value, width, nil
}

// An all-ones size means the writer did not know the length. The marker bit is
// already stripped, so the payload is 7 bits per byte.
func unknownLength(length uint64, sizeLength int) bool {
	return length == uint64(1)<<(7*sizeLength)-1
}

func unsigned(payload []byte) uint64 {
	value := uint64(0)
	for _, b := range payload {
		value = value<<8 | uint64(b)
	}

	return value
}

// Matroska stores a duration as a float, 4 or 8 bytes wide.
func floating(payload []byte) (float64, error) {
	switch len(payload) {
	case 4:
		return float64(math.Float32frombits(binary.BigEndian.Uint32(payload))), nil
	case 8:
		return math.Float64frombits(binary.BigEndian.Uint64(payload)), nil
	default:
		return 0, errNotFound
	}
}
