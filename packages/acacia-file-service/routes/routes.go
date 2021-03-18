package routes

import (
	"context"
	"fmt"
	file "github.com/dsi-icl/acacia/packages/acacia-file-service/file"
	uuid "github.com/google/uuid"
	"github.com/minio/minio-go/v7"
	"io"
	"net/http"
)

func HandleDownload(objStore *minio.Client) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(400)
			return
		}

		// check authorisation; probably jwt

		fileId := r.FormValue("fileId")
		if fileId == "" {
			w.WriteHeader(400)
			return
		}

		// check mongo
		//fileUri := "fdsafdsf"

		// object store
		object, _ := objStore.GetObject(context.Background(), "fsdf", "fdsf", minio.GetObjectOptions{})
		w.WriteHeader(400)
		w.Header().Set("Content-Type", "application/octet-stream")
		io.Copy(w, object)
	}
}

func HandleUpload(objStore *minio.Client) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(400)
			return
		}

		// check authorisation; probably jwt

		fileType := r.FormValue("fileType")
		if fileType == "" || fileType != "USER_FILETYPE" || fileType != "STUDY_FILETYPE" || fileType != "DATA_FILETYPE" {
			w.WriteHeader(400)
			return
		}

		name := r.FormValue("name")
		if fileType == "" {
			w.WriteHeader(400)
			return
		}

		newFileId := uuid.NewString()
		convertedFileType, _ := file.ConvertStringToFileType(fileType)

		newFile := file.File{
			Id:          newFileId,
			FileType:    convertedFileType,
			Name:        name,
			SizeKb:      0,
			Description: "",
			Uri:         fmt.Sprintf("%v|%v", convertedFileType, newFileId),
			Deleted:     false,
		}
		fmt.Println(newFile)

		// insert to mongo

		// object store
		object, _ := objStore.GetObject(context.Background(), "fsdf", "fdsf", minio.GetObjectOptions{})
		w.WriteHeader(400)
		w.Header().Set("Content-Type", "application/octet-stream")
		io.Copy(w, object)
	}
}
