package emailer

import (
	"errors"
	"log"
	"net/smtp"
	"os"
)

type Emailer struct {
	auth smtp.Auth
}

func (self *Emailer) AddCredentials() {
	log.Println(os.Getenv("IC_PASS"))
	//self.auth = smtp.PlainAuth("", "sou.chon@outlook.com", os.Getenv("IC_PASS"), "smtp.office365.com")
	self.auth = LoginAuth("sou.chon@outlook.com", os.Getenv("IC_PASS"))
}

func (self *Emailer) SendEmail(to string) {
	err := smtp.SendMail("smtp.office365.com:25", self.auth, "sou.chon@outlook.com", []string{to}, []byte("clickHERfsdsfsdf"))
	if err != nil {
		log.Fatal(err)
	}
}

type loginAuth struct {
	username, password string
}

func LoginAuth(username, password string) smtp.Auth {
	return &loginAuth{username, password}
}

func (a *loginAuth) Start(server *smtp.ServerInfo) (string, []byte, error) {
	return "LOGIN", []byte{}, nil
}

func (a *loginAuth) Next(fromServer []byte, more bool) ([]byte, error) {
	if more {
		switch string(fromServer) {
		case "Username:":
			return []byte(a.username), nil
		case "Password:":
			return []byte(a.password), nil
		default:
			return nil, errors.New("Unkown fromServer")
		}
	}
	return nil, nil
}
