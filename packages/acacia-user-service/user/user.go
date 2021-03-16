package user

type User struct {
	Id             string
	Pw             string
	Username       string
	RealName       string
	Email          string
	EmailVerified  bool
	OrganisationId string
	Description    string
	CreatedTime    int64
	CreatedBy      string
	Deleted        bool
}

type PasswordResetAttempts struct {
	timestamp string
}
