//! Tap2Mine — Native CLI daemon.
//! Only compiled for non-Wasm targets.
//! Stores keys and blockchain on the user's filesystem.

use std::io::Write;
use std::sync::Arc;
use tokio::sync::Mutex;

use clap::{Parser, Subcommand};
use tap2mine_node::Node;
use tap2mine_node::native;

#[derive(Parser)]
#[command(name = "tap2mine", about = "Backbone Tap2Mine — Decentralized blocklattice node")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Initialize node (generate keys + genesis block)
    Init,
    /// Start JSON-RPC API server on localhost
    Serve {
        #[arg(short, long, default_value_t = 8765)]
        port: u16,
    },
    /// Show node status and chain info
    Info,
    /// Enter tap-to-mine mode (simulated via Enter key)
    Tap,
    /// Reset node (delete all data)
    Reset,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let cli = Cli::parse();

    match cli.command {
        Commands::Init => cmd_init(),
        Commands::Serve { port } => cmd_serve(port).await,
        Commands::Info => cmd_info(),
        Commands::Tap => cmd_tap(),
        Commands::Reset => cmd_reset(),
    }
}

fn cmd_init() {
    let node = Node::new();
    native::save_node(&node).expect("Failed to save node");

    println!("Node initialized!");
    println!("  Node ID:  {}", node.keystore().node_id());
    println!("  Pub Key:  {}", node.keystore().public_key());
    println!("  Data Dir: {}", native::data_dir().display());
    println!("  Genesis:  {}", node.chain().first().map(|b| &b.hash).unwrap());
}

async fn cmd_serve(port: u16) {
    let node = native::load_or_create().expect("Failed to load node");
    let info = serde_json::from_str::<serde_json::Value>(&node.info_json()).unwrap();

    println!("Starting Tap2Mine node...");
    println!("  Node ID: {}", info["node_id"]);
    println!("  Chain:   {} blocks", info["chain_len"]);
    println!("  API:     http://localhost:{}/rpc", port);

    let node = Arc::new(Mutex::new(node));

    if let Err(e) = native::serve(node, port).await {
        eprintln!("Server error: {}", e);
        std::process::exit(1);
    }
}

fn cmd_info() {
    let node = native::load_or_create().expect("No node found. Run 'tap2mine init' first.");
    let info = serde_json::from_str::<serde_json::Value>(&node.info_json()).unwrap();

    println!("Tap2Mine Node Info");
    println!("==================");
    println!("  Node ID:    {}", info["node_id"]);
    println!("  Public Key: {}", info["public_key"]);
    println!("  Chain Len:  {} blocks", info["chain_len"]);
    println!("  Genesis:    {}", info["genesis_hash"]);
    println!("  Latest:     {}", info["latest_hash"]);
    println!("  Data Dir:   {}", native::data_dir().display());
}

fn cmd_tap() {
    let mut node = native::load_or_create().expect("No node found. Run 'tap2mine init' first.");

    println!("Tap-to-Mine mode — press Enter to simulate taps (Ctrl+C to stop)");
    println!("Each tap adds entropy. Blocks are created when entropy threshold is reached.");

    let stdin = std::io::stdin();
    let mut line = String::new();

    loop {
        print!("⚡ tap (Enter): ");
        let _ = std::io::stdout().flush();
        line.clear();
        if stdin.read_line(&mut line).is_err() {
            break;
        }

        // Simulate a burst of entropy from one tap
        for i in 0..8 {
            node.add_tap(i as f64 * 13.7, i as f64 * 7.3);
        }

        let new_block = node.try_mine();
        if !new_block.is_empty() {
            let block = serde_json::from_str::<serde_json::Value>(&new_block).unwrap();
            println!("⛏ New block #{}  seed: {}...  hash: {}...",
                block["sequence"],
                block["seed"].as_str().unwrap_or("").get(..16).unwrap_or(""),
                block["hash"].as_str().unwrap_or("").get(..16).unwrap_or(""));
            native::save_node(&node).expect("Failed to save");
        } else {
            println!("  (collecting entropy... {} events)", node.entropy_count());
        }
    }
}

fn cmd_reset() {
    let data_dir = native::data_dir();
    if data_dir.exists() {
        std::fs::remove_dir_all(&data_dir).expect("Failed to delete data dir");
        println!("Node data deleted: {}", data_dir.display());
    } else {
        println!("No data found at {}", data_dir.display());
    }
}
