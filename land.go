package ishoni_server

type Land struct {
	hubs map[string]*Hub // room

	// Inbound messages from the clients.
	messages chan Message
}

func NewLand() *Land {
	return &Land{
		hubs:     make(map[string]*Hub),
		messages: make(chan Message),
	}
}

func (l *Land) Run() {
	for {
		select {
		case message := <-l.messages:
			handleMessage(message)
		}
	}
}
