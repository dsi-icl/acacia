package routeGuide

import (
	"context"
	"fmt"
	db "github.com/dsi-icl/acacia/packages/acacia-user-service/db"
	msgBkr "github.com/dsi-icl/acacia/packages/acacia-user-service/msgBroker"
	user "github.com/dsi-icl/acacia/packages/acacia-user-service/user"
	pb "github.com/dsi-icl/acacia/packages/acacia-user-service/userProto"
	uuid "github.com/google/uuid"
	"go.mongodb.org/mongo-driver/bson"
	bcrypt "golang.org/x/crypto/bcrypt"
	"time"
)

type Server struct {
	pb.UnimplementedUserServiceServer
}

func (s *Server) GetUser(ctx context.Context, in *pb.GetUserRequest) (*pb.UserResponse, error) {
	var userResult user.User
	dbreq := db.MongoReq{
		Bson: bson.M{"id": in.GetId(), "deleted": false},
	}
	if _, err := db.DbCon.GetOneRecord(&dbreq, &userResult); err != nil {
		return &pb.UserResponse{}, err
	}

	return &pb.UserResponse{
		Id:             userResult.Id,
		Username:       userResult.Username,
		RealName:       userResult.RealName,
		Email:          userResult.Email,
		OrganisationId: userResult.OrganisationId,
		Description:    userResult.Description,
	}, nil
}

func (s *Server) CreateUser(ctx context.Context, in *pb.CreateUserRequest) (*pb.UserResponse, error) {
	//TODO: send verification email
	//TODO: check organisationId is valid
	//TODO: check createdBy is valid

	encryptedPw, err := bcrypt.GenerateFromPassword(([]byte)(in.GetPw()), 10)
	if err != nil {
		return &pb.UserResponse{}, err
	}

	newUser := user.User{
		Id:             uuid.NewString(),
		Username:       in.GetUsername(),
		RealName:       in.GetRealName(),
		Pw:             string(encryptedPw),
		Email:          in.GetEmail(),
		EmailVerified:  false,
		OrganisationId: in.GetOrganisationId(),
		Description:    in.GetDescription(),
		CreatedTime:    time.Now().Unix(),
		CreatedBy:      "fdsf",
		Deleted:        false,
	}
	bsonReq := db.MongoReq{
		Bson: newUser,
	}

	if err := db.DbCon.InsertRecord(&bsonReq); err != nil {
		return &pb.UserResponse{}, err
	}

	go msgBkr.MsgBkrConn.Write(fmt.Sprintf("USER_REGISTRATION|%v", newUser.Email))

	return &pb.UserResponse{
		Id:             newUser.Id,
		Username:       newUser.Username,
		RealName:       newUser.RealName,
		Email:          newUser.Email,
		OrganisationId: newUser.OrganisationId,
		Description:    newUser.Description,
		EmailVerified:  false,
	}, nil
}

func (s *Server) EditUser(ctx context.Context, in *pb.EditUserRequest) (*pb.UserResponse, error) {
	return &pb.UserResponse{
		Id:             "fdsf",
		Username:       "fds",
		RealName:       "fsdfsaf",
		Email:          "sou.conWo",
		OrganisationId: "fjdsiofjsdif",
		Description:    "fsdjfklsd",
	}, nil
}

func (s *Server) DeleteUser(ctx context.Context, in *pb.DeleteUserRequest) (*pb.DeleteUserResponse, error) {
	return &pb.DeleteUserResponse{
		Successful: true,
	}, nil
}
