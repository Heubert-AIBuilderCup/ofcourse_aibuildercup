import net from 'node:net'

const port = Number(process.argv[2] ?? 3000)

const tester = net
  .createServer()
  .once('error', (err) => {
    if (/** @type {NodeJS.ErrnoException} */ (err).code === 'EADDRINUSE') {
      console.error(`\n✗ Port ${port} is already in use.`)
      console.error(
        '  This project is pinned to that port to avoid confusion across environments.\n',
      )
      console.error('  Find the process holding it:')
      console.error(`    lsof -iTCP:${port} -sTCP:LISTEN\n`)
      console.error('  Then stop it (replace <pid>):')
      console.error('    kill <pid>\n')
      process.exit(1)
    }
    throw err
  })
  .once('listening', () => {
    tester.once('close', () => process.exit(0)).close()
  })
  .listen(port, '0.0.0.0')
