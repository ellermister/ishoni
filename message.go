package ishoni_server

import (
	"encoding/json"
	"fmt"
	"log"
	"strings"
)

type Message struct {
	Command   string `json:"command"`
	Data      string `json:"data"`
	RequestId string `json:"id"`
	client    *Client
}

type JsonResult struct {
	Code      int    `json:"code"`
	Message   string `json:"message"`
	RequestId string `json:"id"`
}

func parseMessage(t string) (Message, error) {

	var message Message
	err := json.Unmarshal([]byte(t), &message)
	if err != nil {
		log.Printf("failed to unmarshal on ParseMessage: %s\n", err)
		return message, err
	}

	return message, nil
}

func CreateRoom(m Message) {
	if m.client.roomId != "" {
		msg, _ := json.Marshal(JsonResult{Code: 500, Message: fmt.Sprintf("You are already in the room %s", m.client.roomId), RequestId: m.RequestId})
		m.client.send <- msg
		log.Printf("You are already in the room %s\n", m.client.roomId)
		return
	}

	client := m.client
	land := client.land
	roomId := strings.TrimSpace(m.Data)
	if _, exists := land.hubs[roomId]; exists {
		msg, _ := json.Marshal(JsonResult{Code: 500, Message: fmt.Sprintf("The room %s already exists", roomId), RequestId: m.RequestId})
		m.client.send <- msg
		log.Printf("The room %s already exists\n", roomId)
		return
	}

	if client.roomId == "" {
		hub := NewHub()
		go hub.Run()

		client.hub = hub
		hub.register <- client
		land.hubs[roomId] = hub

		client.roomId = roomId

		msg, _ := json.Marshal(JsonResult{Code: 200, Message: fmt.Sprintf("The client created and joins rooms %s", m.client.roomId), RequestId: m.RequestId})
		m.client.send <- msg
		log.Printf("The client created and joins rooms %s\n", m.client.roomId)
	}
}

func JoinRoom(m Message) {
	roomId := strings.TrimSpace(m.Data)
	if m.client.roomId == "" {
		client := m.client
		land := client.land

		if _, exists := land.hubs[roomId]; exists {
			land.hubs[roomId].register <- client

			client.hub = land.hubs[roomId]

			client.roomId = roomId

			msg, _ := json.Marshal(JsonResult{Code: 200, Message: fmt.Sprintf("Already entered the room %s", m.client.roomId), RequestId: m.RequestId})
			m.client.send <- msg
			log.Printf("Already entered the room %s\n", m.client.roomId)

			// 广播有人加入
			membersUpdate, _ := json.Marshal(Message{Command: "MembersUpdate", Data: "", RequestId: m.client.uuid})
			m.client.land.hubs[roomId].broadcast <- membersUpdate

		} else {
			msg, _ := json.Marshal(JsonResult{Code: 500, Message: fmt.Sprintf("The Room %s is not found", roomId), RequestId: m.RequestId})
			m.client.send <- msg
			log.Printf("The Room (%s) is not found\n", roomId)
		}
	} else {
		var code int
		if roomId == m.client.roomId {
			code = 200
		} else {
			code = 500
		}
		msg, _ := json.Marshal(JsonResult{Code: code, Message: fmt.Sprintf("You are already in the room %s", m.client.roomId), RequestId: m.RequestId})
		m.client.send <- msg
		log.Printf("You are already in the room %s\n", m.client.roomId)
	}
}

func LeaveRoom(c *Client) {
	if _, exists := c.land.hubs[c.roomId]; exists {
		c.land.hubs[c.roomId].unregister <- c

		// 广播有人离开
		membersLeave, _ := json.Marshal(Message{Command: "MembersLeave", Data: "", RequestId: c.uuid})
		c.land.hubs[c.roomId].broadcast <- membersLeave
	}
}

func BroadcastMessage(m Message) {

	if m.client.roomId == "" {
		msg, _ := json.Marshal(JsonResult{Code: 500, Message: fmt.Sprintf("You have not joined any room"), RequestId: m.RequestId})
		m.client.send <- msg
		log.Printf("You have not joined any room\n")
	} else {
		roomId := m.client.roomId
		msg, _ := json.Marshal(Message{Command: "Broadcast", Data: m.Data, RequestId: m.client.uuid})
		m.client.land.hubs[roomId].broadcast <- msg
	}
}

func UpdateName(m Message) {
	name := []rune(strings.TrimSpace(m.Data))
	if len(name) > 16 {
		name = name[:16]
	}
	m.client.name = string(name)

	roomId := m.client.roomId
	msg, _ := json.Marshal(Message{Command: "UpdateName", Data: m.Data, RequestId: m.client.uuid})
	m.client.land.hubs[roomId].broadcast <- msg
}

type Member struct {
	Uuid string `json:"uuid"`
	Name string `json:"name"`
}

type RoomsResult struct {
	JsonResult
	Members []Member `json:"members"`
	Size    int      `json:"size"`
	Uuid    string   `json:"uuid"`
}

func GetRooms(m Message) {
	if m.client.roomId == "" {
		msg, _ := json.Marshal(JsonResult{Code: 500, Message: fmt.Sprintf("You have not joined any room"), RequestId: m.RequestId})
		m.client.send <- msg
		log.Printf("You have not joined any room\n")
		return
	}
	roomId := m.client.roomId

	members := make([]Member, 0)

	for member := range m.client.land.hubs[roomId].clients {
		members = append(members, Member{Uuid: member.uuid, Name: member.name})
	}

	log.Printf("[GetRooms] room id: %s  members count: %d uuid: %s\n", roomId, len(members), m.client.uuid)

	jsonResult := RoomsResult{Members: members, Size: len(members), Uuid: m.client.uuid}
	jsonResult.Code = 200
	jsonResult.Message = "room"
	jsonResult.RequestId = m.RequestId
	msg, _ := json.Marshal(jsonResult)
	m.client.send <- msg
}

var MessageHandler = make(map[string]func(message Message))

func RegisterHandler() {

	MessageHandler["CreateRoom"] = CreateRoom
	MessageHandler["JoinRoom"] = JoinRoom
	MessageHandler["BroadcastMessage"] = BroadcastMessage
	MessageHandler["UpdateName"] = UpdateName
	MessageHandler["GetRooms"] = GetRooms
}

func handleMessage(m Message) {
	if _, exists := MessageHandler[m.Command]; exists {
		log.Printf("[handleMessage.%s] uuid: %s\n", m.Command, m.client.uuid)
		handler := MessageHandler[m.Command]
		handler(m)
	} else {
		log.Printf("[handleMessage.%s] unimplemented method\n", m.Command)
	}
}
