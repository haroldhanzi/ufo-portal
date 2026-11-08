// Optional local development relay when Windows cannot reach WSL Docker's published port.
const net = require('node:net');
const { spawn, execFile } = require('node:child_process');
const localPort = Number(process.env.UFO_WINDOWS_PORT || 8090);
const containerPort = process.env.UFO_DOCKER_PORT || '8080';
const distro = process.env.UFO_WSL_DISTRO || 'Ubuntu-26.04';
const server = net.createServer(socket => {
  const connect = host => {
  const relay = spawn('wsl.exe', ['-d', distro, '--', '/usr/bin/nc', host, containerPort], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  socket.pipe(relay.stdin); relay.stdout.pipe(socket);
  socket.on('error', () => relay.kill()); socket.on('close', () => relay.kill());
  relay.stdin.on('error', () => socket.destroy()); relay.stdout.on('error', () => socket.destroy());
  relay.on('error', () => socket.destroy()); relay.on('exit', () => socket.end());
  relay.stderr.resume();
  };
  if (process.env.UFO_DOCKER_CONTAINER) {
    execFile('wsl.exe', ['-d', distro, '--', '/snap/bin/docker', 'inspect', '--format', '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}', process.env.UFO_DOCKER_CONTAINER], { windowsHide: true }, (error, output) => {
      const host = output.trim();
      if (error || !/^\d+\.\d+\.\d+\.\d+$/.test(host)) return socket.destroy();
      if (!socket.destroyed) connect(host);
    });
  } else connect('127.0.0.1');
});
server.listen(localPort, '127.0.0.1', () => console.log(`Windows relay ready: http://localhost:${localPort}`));
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
