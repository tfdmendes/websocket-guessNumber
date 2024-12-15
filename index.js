const http = require("http");
const express = require("express");
const app = express();

app.use(express.static(__dirname));
app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));

app.listen(80, () => console.log("Listening on http port 80")); 

const websocketServer = require("websocket").server;
const httpServer = http.createServer();
// websocket traffic goes through 9090
httpServer.listen(9090, () => console.log("Listening on websocket port 9090"));

// ? client dictionary: { clientId: { connection } }
const clients = {};

// ? game dictionary: { gameId: { id, secretNumber, clients: [{clientId}], state } }
const games = {};

const wsServer = new websocketServer({
    "httpServer": httpServer
});

// WebSocket Server !
wsServer.on("request", request => {
    
    // This is the TCP connection; Accepts any protocol
    const connection = request.accept(null, request.origin);
    const clientIp = request.socket.remoteAddress;
    const clientPort = request.socket.remotePort;

    console.log(`Connection opened with: IP:${clientIp}:${clientPort}`);

    // whenever a new client connects, a clientId is generated 
    const clientId = guid();
    clients[clientId] = {
        "connection": connection
    };

    //! send back the clientID to the client himself
    const payLoad = {
        "method": "connect",
        "clientId": clientId
    };
    connection.send(JSON.stringify(payLoad)); //! sending back the client connect 


    connection.on("close", () => {
        console.log(`Closed connection with: IP:${clientIp}:${clientPort}`);
        // removing the client from the list 
        delete clients[clientId];
    });
    

    connection.on("message", message => {
        const result = JSON.parse(message.utf8Data);
        console.log(result)

        if (result.method === "create") {
            const clientId = result.clientId;
            const gameId = guid();

            games[gameId] = {
                "id": gameId,
                "secretNumber": Math.floor(Math.random() * 200) + 1,
                "clients": [{ clientId: clientId }]
            };
            
            console.log(`Number generated: ${games[gameId].secretNumber}`);

            const payLoad = {
                "method": "create",
                "game": {
                    "id": gameId,
                    "msg": "Jogo criado! Compartilha o gameId para outros jogadores entrarem."
                }
            };

            const con = clients[clientId].connection;
            con.send(JSON.stringify(payLoad));

        } else if (result.method === "chat") {

            const payLoad = {
                "method": "chat",
                "clientId": result.clientId,
                "message": result.text
            };

            broadCastMessage(payLoad, result.clientId);


        } else if (result.method === "join") {
            const clientId = result.clientId;
            const gameId = result.gameId;
            const game = games[gameId];


            if (!game) {
                // game doesnt exist     
                const payLoad = {
                    "method": "error",
                    "message": "Esse jogo nao existe."
                };
                clients[clientId].connection.send(JSON.stringify(payLoad));
                return;
            }

            // adding the player to the game 
            game.clients.push({ clientId: clientId });

            const payLoad = {
                "method": "join",
                "game": {
                    "id": gameId,
                    "clientsCount": game.clients.length,
                    "msg": `Entraste no jogo ${gameId}. Agora ha ${game.clients.length} jogadores.`
                }
            };

            // notifies that the client joined 
            
            clients[clientId].connection.send(JSON.stringify(payLoad));

            // broadcast to every1 that a new player joined 
            broadcastToGame(gameId, {
                "method": "updatePlayers",
                "msg": `O jogador ${clientId} entrou no jogo! Agora ha ${game.clients.length} jogadores`,
                "players": game.clients.map(c => c.clientId)
            }, clientId);


        } else if (result.method === "guess") {
            const clientId = result.clientId;
            const gameId = result.gameId;
            const guess = parseInt(result.number, 10);

            const game = games[gameId];
            if (!game) {
                const payLoad = {
                    "method": "error",
                    "message": "Jogo nao encontrado"
                };
                clients[clientId].connection.send(JSON.stringify(payLoad));
                return;
            }

            // Checking if the guess matches the secret number 
            if (guess === game.secretNumber) {
                // * rever payLoad ?
                const payLoad = {
                    "method": "result",
                    "winner": clientId,
                    "secretNumber": game.secretNumber,
                    "msg": `Ganhaste o jogo. O numero era ${game.secretNumber}.`
                };

                clients[clientId].connection.send(JSON.stringify(payLoad));

                broadcastToGame(gameId, {
                    "method": "result",
                    "winner": clientId,
                    "secretNumber": game.secretNumber,
                    "msg": `O jogador ${clientId} acertou o numero! O numero era ${game.secretNumber}.`
                }, clientId);

                delete games[gameId]; //ends the game 
            } else if (guess < game.secretNumber) {
                const payLoad = {
                    "method": "hint",
                    "msg": `${guess} e baixo, o numero e maior!`
                };
                clients[clientId].connection.send(JSON.stringify(payLoad));
            } else {
                const payLoad = {
                    "method": "hint",
                    "msg": `${guess} e alto, o numero e menor!`
                };
                clients[clientId].connection.send(JSON.stringify(payLoad));
            }
        }
    });
});


function broadcastToGame(gameId, messageObject, clientId) {
    const game = games[gameId];
    if (!game) return;
    const message = JSON.stringify(messageObject);
    game.clients.filter(id => id.clientId !== clientId).forEach(c => {
        if (clients[c.clientId]) {
            clients[c.clientId].connection.send(message);
        }
    });
}

function broadCastMessage(messageObject, clientId) {
    const message = JSON.stringify(messageObject);
    for (const cId in clients) {
        if (clients[cId] && cId !== clientId) {
            clients[cId].connection.send(message);
        }
    }
}


// https://stackoverflow.com/posts/44996682/revisions
// function S4() {
//     return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
// }
// const guid = () => (S4() + S4() + "-" + S4() + "-4" + S4().substr(0,3) + "-" + S4() + "-" + S4() + S4() + S4()).toLowerCase();

// Simpler GUID
const guid = () => Math.random().toString(36).substr(2, 8) + '-' + Math.random().toString(36).substr(2, 4);


