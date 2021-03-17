package userJwt

import (
	jwt "gopkg.in/dgrijalva/jwt-go.v3"
)

type UserJwtClaims struct {
	Username       string `json:"foo"`
	RealName       string `json:"realName"`
	Description    string `json:"description"`
	Email          string `json:"email"`
	OrganisationId string `json:"organisationId"`
	jwt.StandardClaims
}
