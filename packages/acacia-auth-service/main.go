package main

import (
	grpcClient "github.com/dsi-icl/acacia/packages/acacia-auth-service/grpcClient"
	routes "github.com/dsi-icl/acacia/packages/acacia-auth-service/routes"
	"google.golang.org/grpc"
	"log"
	"net/http"
	"time"
)

func main() {
	serverAddr := "localhost:50051"
	opts := []grpc.DialOption{
		grpc.WithInsecure(),
		grpc.WithBlock(),
		grpc.WithTimeout(time.Duration(5e9 /*5 seconds*/)),
	}
	conn, err := grpc.Dial(serverAddr, opts...)
	log.Println("connected to grpc server")
	if err != nil {
		log.Fatalf("fail to dial: %v", err)
	}
	defer conn.Close()
	grpcClient.UserServiceClient.ConnectClient(conn)

	http.HandleFunc("/login", routes.Login)

	log.Fatal(http.ListenAndServe(":8080", nil))
}
