package main

import (
	"context"
	"fmt"
	emailer "github.com/dsi-icl/acacia/packages/acacia-email-service/emailer"
	kafka "github.com/segmentio/kafka-go"
	"log"
	"strings"
	"time"
)

func main() {
	emailClient := emailer.Emailer{}
	emailClient.AddCredentials()

	topic := "email"
	partition := 0

	conn, err := kafka.DialLeader(context.Background(), "tcp", "localhost:32770", topic, partition)
	if err != nil {
		log.Fatal("failed to dial leader:", err)
	}

	conn.SetReadDeadline(time.Now().Add(10 * time.Second))
	b := make([]byte, 10e3) // 10KB max per message
	x := 1
	for {
		//TODO: check whether this is blocking? -- should be blocking and stop retrying
		_, err := conn.Read(b)
		fmt.Println("there")
		if err != nil {
			break
		}
		if x == 1 {
			splitStr := strings.Split(string(b), "|")
			fmt.Println(splitStr[1])
			emailClient.SendEmail(splitStr[1])
			x = x + 1
		}
	}

	if err := conn.Close(); err != nil {
		log.Fatal("failed to close connection:", err)
	}
}
