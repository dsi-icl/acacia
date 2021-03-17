package grpcClient

import (
	acaciaUserProto "github.com/dsi-icl/acacia/packages/acacia-user-service/userProto"
	grpc "google.golang.org/grpc"
)

var UserServiceClient = GrpcClient{}

type GrpcClient struct {
	Client acaciaUserProto.UserServiceClient
}

func NewClient() GrpcClient {
	return GrpcClient{}
}

func (self *GrpcClient) ConnectClient(conn *grpc.ClientConn) {
	self.Client = acaciaUserProto.NewUserServiceClient(conn)
}
