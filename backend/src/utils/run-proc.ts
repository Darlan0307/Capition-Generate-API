import { spawn } from "child_process";

export async function runProc(
  cmd: string,
  args: string[],
  opts: any = {}
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, opts);
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? 0 }));

    child.on("error", (err) => {
      console.error(`Erro ao executar ${cmd}:`, err);
      reject(err);
    });
  });
}
