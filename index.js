const http = require("http");
const express = require("express");
const app = express();

app.use(express.static(__dirname));
app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));
// port that will host the page; And the HTML page has code that connects
// to port 9090 (where the websocket is hosted)
app.listen(9091, () => console.log("Listening on http port 9091")); 

const websocketServer = require("websocket").server;
const httpServer = http.createServer();
// websocket traffic goes through 9090
httpServer.listen(9090, () => console.log("Listening on port 9090"));

// client dictionary: { clientId: { connection } }
const clients = {};

// game dictionary: { gameId: { id, secretNumber, clients: [{clientId}], state } }
const games = {};

const wsServer = new websocketServer({
    "httpServer": httpServer
});

// WebSocket Server !
wsServer.on("request", request => {
    // accept any protocol
    // This is the TCP connection
    const connection = request.accept(null, request.origin);

    const clientIp = request.socket.remoteAddress;
    const clientPort = request.socket.remotePort;

    console.log(`Connection opened with: IP:${clientIp}:${clientPort}`);

    // whenever a new client connects, a clientId is generated 
    const clientId = guid();
    clients[clientId] = {
        "connection": connection
    };

    // send back the clientID to the client himself
    const payLoad = {
        "method": "connect",
        "clientId": clientId
    };

    // sending back the client connect 
    connection.send(JSON.stringify(payLoad));

    connection.on("close", () => {
        console.log(`Closed connection with: IP:${clientIp}:${clientPort}`);
        // removing the client from the list 
        delete clients[clientId];
    });
    
    connection.on("message", message => {
        const result = JSON.parse(message.utf8Data);
        // console.log(result)


        if (result.method === "create") {
            const clientId = result.clientId;
            const gameId = guid();

            // creating the secret number 
            games[gameId] = {
                "id": gameId,
                "secretNumber": Math.floor(Math.random() * 100) + 1,
                "clients": [{ clientId: clientId }]
            };

            console.log(`O número gerado foi ${games[gameId].secretNumber}`);

            const payLoad = {
                "method": "create",
                "game": {
                    "id": gameId,
                    "msg": "Jogo criado! Compartilhe o gameId para outros jogadores entrarem."
                }
            };

            const con = clients[clientId].connection;
            con.send(JSON.stringify(payLoad));

        } else if (result.method === "join") {
            const clientId = result.clientId;
            const gameId = result.gameId;
            const game = games[gameId];


            if (!game) {
                // game doesnt exist     
                const payLoad = {
                    "method": "error",
                    "message": "Esse jogo não existe."
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
                    "msg": `Você entrou no jogo ${gameId}. Agora há ${game.clients.length} jogadores.`
                }
            };

            // notifies that the client joined 
            
            clients[clientId].connection.send(JSON.stringify(payLoad));

            // broadcast to every1 that a new player joined 
            broadcastToGame(gameId, {
                "method": "updatePlayers",
                "msg": `O jogador ${clientId} entrou no jogo! Agora há ${game.clients.length} jogadores`,
                "players": game.clients.map(c => c.clientId)
            }, clientId);

        } else if (result.method === "guess") {
            // O cliente faz um palpite
            const clientId = result.clientId;
            const gameId = result.gameId;
            const guess = parseInt(result.number, 10);

            const game = games[gameId];
            if (!game) {
                const payLoad = {
                    "method": "error",
                    "message": "Jogo não encontrado"
                };
                clients[clientId].connection.send(JSON.stringify(payLoad));
                return;
            }

            // Verifica palpite
            if (guess === game.secretNumber) {
                // * rever payLoad ?
                const payLoad = {
                    "method": "result",
                    "winner": clientId,
                    "secretNumber": game.secretNumber,
                    "msg": `Ganhaste o jogo. O número era ${game.secretNumber}.`
                };

                clients[clientId].connection.send(JSON.stringify(payLoad));

                broadcastToGame(gameId, {
                    "method": "result",
                    "winner": clientId,
                    "secretNumber": game.secretNumber,
                    "msg": `O jogador ${clientId} acertou o número! O número era ${game.secretNumber}.`
                }, clientId);

                delete games[gameId]; //ends the game 
            } else if (guess < game.secretNumber) {
                const payLoad = {
                    "method": "hint",
                    "msg": `${guess} é baixo, o número é maior!`
                };
                clients[clientId].connection.send(JSON.stringify(payLoad));
            } else {
                const payLoad = {
                    "method": "hint",
                    "msg": `${guess} é alto, o número é menor!`
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

//* https://stackoverflow.com/posts/44996682/revisions
function S4() {
    return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
}
const guid = () => (S4() + S4() + "-" + S4() + "-4" + S4().substr(0,3) + "-" + S4() + "-" + S4() + S4() + S4()).toLowerCase();

