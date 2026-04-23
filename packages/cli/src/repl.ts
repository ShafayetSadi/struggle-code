import readline from "node:readline";

export async function startRepl() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "You > ",
  });

  console.log("🤖 Struggle AI CLI");
  console.log('Type "exit" to quit.\n');
  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    if (input.toLowerCase() === "exit") {
      console.log("Goodbye! 👋");
      rl.close();
      return;
    }

    try {
      // Replace this with real AI response
      const response = await getAIResponse(input);
      console.log(`AI > ${response}\n`);
    } catch (err) {
      console.error(`Error: ${err.message}\n`);
    }

    rl.prompt();
  });

  rl.on("close", () => {
    process.exit(0);
  });
}

// Placeholder — replace with real AI call
async function getAIResponse(input:any) {
  return `You said: ${input}`;
}