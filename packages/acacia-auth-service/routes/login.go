package routes

import (
	"context"
	"encoding/json"
	errors "github.com/dsi-icl/acacia/packages/acacia-auth-service/errors"
	grpcClient "github.com/dsi-icl/acacia/packages/acacia-auth-service/grpcClient"
	userJwt "github.com/dsi-icl/acacia/packages/acacia-auth-service/userJwt"
	acaciaUserProto "github.com/dsi-icl/acacia/packages/acacia-user-service/userProto"
	jwt "gopkg.in/dgrijalva/jwt-go.v3"
	"log"
	"net/http"
	"time"
)

type LoggedInResponse struct {
	Jwt string
}

func Login(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	if r.Method != http.MethodPost {
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(&errors.ErrorResponse{
			ErrorCode: 1,
			ErrorMsg:  "GET not allowed",
		})
		return
	}

	username := r.PostFormValue("username")
	if username == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(&errors.ErrorResponse{
			ErrorCode: 1,
			ErrorMsg:  "Username not provided",
		})
		return
	}

	pw := r.PostFormValue("pw")
	if pw == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(&errors.ErrorResponse{
			ErrorCode: 1,
			ErrorMsg:  "Password not provided",
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	response, err := grpcClient.UserServiceClient.Client.VerifyUserPassword(ctx, &acaciaUserProto.VerifyUserPasswordRequest{
		Username: username,
		Pw:       pw,
	})
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(&errors.ErrorResponse{
			ErrorCode: 2,
			ErrorMsg:  "Credentials are not right.",
		})
		return
	}

	////// create jwt ///
	tokenClaims := userJwt.UserJwtClaims{
		"bar",
		jwt.StandardClaims{
			ExpiresAt: 15000,
			Issuer:    "test",
		},
	}
	token := jwt.NewWithClaims(jwt.GetSigningMethod("HS256"), tokenClaims)
	tokenString, err := token.SignedString([]byte("trialkey"))
	w.WriteHeader(200)
	json.NewEncoder(w).Encode(&LoggedInResponse{
		Jwt: tokenString,
	})
}
