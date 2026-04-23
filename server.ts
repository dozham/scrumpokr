import { createServer } from 'http'
import next from 'next'
import { attachWebSocket } from './src/ws/handler'
import { startCleanup } from './src/lib/registry'

const dev = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT ?? '8080', 10)

const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res))

  attachWebSocket(server)
  startCleanup()

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`)
  })
})
