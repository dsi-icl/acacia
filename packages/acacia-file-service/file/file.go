package file

import (
	"errors"
	"fmt"
)

const (
	USER_FILETYPE = iota
	STUDY_FILETYPE
	DATA_FILETYPE
)

type File struct {
	Id          string
	FileType    int
	Name        string
	SizeKb      int
	Description string
	Uri         string
	Deleted     bool
}

func ConvertStringToFileType(str string) (int, error) {
	switch str {
	case "USER_FILETYPE":
		return USER_FILETYPE, nil
	case "STUDY_FILETYPE":
		return STUDY_FILETYPE, nil
	case "DATA_FILETYPE":
		return DATA_FILETYPE, nil
	}
	return 0, errors.New(fmt.Sprintf("File type \"%v\" not supported", str))
}
