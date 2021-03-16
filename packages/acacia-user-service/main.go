package main

import (
	"log"
	"net"
	//"github.com/dsi-icl/acacia/packages/acacia-user-service/user"
	db "github.com/dsi-icl/acacia/packages/acacia-user-service/db"
	msgBkr "github.com/dsi-icl/acacia/packages/acacia-user-service/msgBroker"
	rg "github.com/dsi-icl/acacia/packages/acacia-user-service/routeGuide"
	pb "github.com/dsi-icl/acacia/packages/acacia-user-service/userProto"
	"google.golang.org/grpc"
)

const (
	port = ":50051"
)

func main() {
	db.DbCon.Connect()
	msgBkr.MsgBkrConn.Connect()

	lis, err := net.Listen("tcp", port)
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}
	s := grpc.NewServer()
	pb.RegisterUserServiceServer(s, &rg.Server{})
	if err := s.Serve(lis); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}
