export function parseArgs(argv: string[]): Record<string, any> {
  const result: Record<string, any> = { _: [] };
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      // Support --key=value
      if (key.includes("=")) {
        const [k, v] = key.split("=");
        result[k] = parseValue(v);
        i++;
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith("-")) {
        // Support --key value
        result[key] = parseValue(argv[i + 1]);
        i += 2;
      } else {
        // Boolean flag: --flag
        result[key] = true;
        i++;
      }
    } else if (arg.startsWith("-") && arg.length === 2) {
      // Short flags: -f value
      const key = arg.slice(1);
      if (i + 1 < argv.length && !argv[i + 1].startsWith("-")) {
        result[key] = parseValue(argv[i + 1]);
        i += 2;
      } else {
        result[key] = true;
        i++;
      }
    } else {
      // Unnamed positional args
      result._.push(arg);
      i++;
    }
  }
  return result;
}

function parseValue(v: string): any {
  if (v === "true") return true;
  if (v === "false") return false;
  // keep addresses as strings
  if (/^0x[0-9a-fA-F]+$/.test(v)) return v;
  if (!isNaN(Number(v)) && v.trim() !== "") return Number(v);
  return v;
}
