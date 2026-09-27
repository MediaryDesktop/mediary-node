package prober

import (
	"encoding/binary"
	"io"
	"time"
)

// ISO base media files are a tree of boxes, each "size, four-letter type, body".
// The duration sits in the movie header, moov/mvhd, which every player has to
// read before it can play anything — so it is near the front in any file meant
// to be streamed, and at worst at the end in one written by a recorder.
func isoDuration(reader io.ReadSeeker, size int64) (time.Duration, error) {
	moov, err := findISOBox(reader, 0, size, "moov")
	if err != nil {
		return 0, err
	}

	mvhd, err := findISOBox(reader, moov.body, moov.end, "mvhd")
	if err != nil {
		return 0, err
	}

	return readMovieHeader(reader, mvhd)
}

type isoBox struct {
	// body is where the box's contents start and end is where the box stops,
	// both absolute in the file.
	body int64
	end  int64
}

const isoHeaderSize = 8

func findISOBox(reader io.ReadSeeker, from, until int64, want string) (isoBox, error) {
	header := make([]byte, isoHeaderSize)

	for offset := from; offset+isoHeaderSize <= until; {
		if _, err := reader.Seek(offset, io.SeekStart); err != nil {
			return isoBox{}, err
		}
		if _, err := io.ReadFull(reader, header); err != nil {
			return isoBox{}, err
		}

		boxSize := int64(binary.BigEndian.Uint32(header[:4]))
		body := offset + isoHeaderSize

		switch boxSize {
		// A 64-bit size follows the type when the 32-bit field reads 1.
		case 1:
			large := make([]byte, 8)
			if _, err := io.ReadFull(reader, large); err != nil {
				return isoBox{}, err
			}

			boxSize = signed(binary.BigEndian.Uint64(large))
			body += 8

		// Zero means the box runs to the end of the file.
		case 0:
			boxSize = until - offset
		}

		if boxSize < body-offset || offset+boxSize > until {
			return isoBox{}, errNotFound
		}

		if string(header[4:8]) == want {
			return isoBox{body: body, end: offset + boxSize}, nil
		}

		offset += boxSize
	}

	return isoBox{}, errNotFound
}

// mvhd carries the timescale — how many units make a second — and the duration
// in those units. Version 1 widened the timestamps and the duration to 64 bits;
// the timescale stayed 32.
func readMovieHeader(reader io.ReadSeeker, box isoBox) (time.Duration, error) {
	if _, err := reader.Seek(box.body, io.SeekStart); err != nil {
		return 0, err
	}

	head := make([]byte, 4)
	if _, err := io.ReadFull(reader, head); err != nil {
		return 0, err
	}

	// Creation and modification time, then the timescale and the duration.
	const (
		version0Fields = 4 + 4 + 4 + 4
		version1Fields = 8 + 8 + 4 + 8
	)

	version := head[0]

	length := version0Fields
	if version == 1 {
		length = version1Fields
	}

	body := make([]byte, length)
	if _, err := io.ReadFull(reader, body); err != nil {
		return 0, err
	}

	var timescale uint32
	var units uint64

	if version == 1 {
		timescale = binary.BigEndian.Uint32(body[16:20])
		units = binary.BigEndian.Uint64(body[20:28])
	} else {
		timescale = binary.BigEndian.Uint32(body[8:12])
		units = uint64(binary.BigEndian.Uint32(body[12:16]))
	}

	// A recorder that never closed the file writes a placeholder duration, and
	// the all-ones value is the agreed way of saying "unknown".
	if timescale == 0 || units == 0 || units == 1<<32-1 {
		return 0, errNotFound
	}

	return time.Duration(float64(units) / float64(timescale) * float64(time.Second)), nil
}
