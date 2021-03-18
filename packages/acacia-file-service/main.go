package main

import (
	"context"
	routes "github.com/dsi-icl/acacia/packages/acacia-file-service/routes"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"log"
	"net/http"
)

func main() {
	endpoint := "localhost:9000"
	accessKeyID := "minioadmin"
	secretAccessKey := "minioadmin"
	useSSL := false

	// Initialize minio client object.
	minioClient, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKeyID, secretAccessKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		log.Fatalln(err)
	}

	ctx := context.Background()
	info, err := minioClient.ListBuckets(ctx)

	log.Println(info)
	log.Println(err)

	http.HandleFunc("/download", routes.HandleDownload(minioClient))
	http.HandleFunc("/upload", routes.HandleUpload(minioClient))

	log.Fatal(http.ListenAndServe(":8080", nil))

}
