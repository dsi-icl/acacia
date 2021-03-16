package msgBroker

import (
	"context"
	kafka "github.com/segmentio/kafka-go"
	"log"
	"time"
)

var MsgBkrConn KafkaConnection

type KafkaConnection struct {
	conn *kafka.Conn
}

func (self *KafkaConnection) Connect() {
	conn, err := kafka.DialLeader(context.Background(), "tcp", "localhost:32770", "email", 0)
	if err != nil {
		log.Fatal("failed to dial leader:", err)
	}
	self.conn = conn
}

func (self *KafkaConnection) Write(msg string) {
	self.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
	_, err := self.conn.WriteMessages(
		kafka.Message{Value: []byte(msg)},
	)
	if err != nil {
		log.Fatal("failed to dial leader:", err)
	}
}
