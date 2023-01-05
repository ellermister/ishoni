package main

import (
	"fmt"
	"github.com/gorilla/websocket"
	harmoniser "ishoni"
	"net/http"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

type Client struct {

	// The websocket connection.
	conn *websocket.Conn

	// Buffered channel of outbound messages.
	send chan []byte
}

func HelloHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, "Hello World "+harmoniser.GetVersion())
}

func main() {
	land := harmoniser.NewLand()
	go land.Run()

	harmoniser.RegisterHandler()

	http.HandleFunc("/", HelloHandler)
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		harmoniser.ServeWs(land, w, r)
	})
	http.ListenAndServe(":8000", nil)
}
