import { createServer } from 'http'
import next from 'next'
import { attachWebSocket } from './src/ws/handler'
import { getAdapter } from './src/lib/store'

const dev = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT ?? '8080', 10)

const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res))

  attachWebSocket(server)
  getAdapter().startCleanup()

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`)
  })
})
