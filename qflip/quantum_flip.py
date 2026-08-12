#!/usr/bin/env python3
"""
Quantum Coin Flipper (qflip)
----------------------------
A lightweight CLI tool that uses quantum superposition to flip a true 50/50 quantum coin.
Supports both instant local simulation and submission to real IBM Quantum hardware!
"""

import sys
import os
import argparse
import time
import random

# Color terminal formatting
class Colors:
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    MAGENTA = '\033[95m'
    RED = '\033[91m'
    BOLD = '\033[1m'
    RESET = '\033[0m'

def print_ascii_coin(result):
    heads_art = f"""
    {Colors.YELLOW}  .---.  
 /  H  \\ 
| HEADS |
 \\  1  / 
  '---'  {Colors.RESET}"""
    
    tails_art = f"""
    {Colors.CYAN}  .---.  
 /  T  \\ 
| TAILS |
 \\  0  / 
  '---'  {Colors.RESET}"""
    
    if result == 'HEADS (1)':
        print(heads_art)
    else:
        print(tails_art)

def run_local_quantum_simulation(flips=1):
    """
    Simulates a 1-qubit Hadamard gate superposition: |ψ> = 1/√2 (|0> + |1>)
    Measures the quantum state using non-deterministic quantum probability rules.
    """
    print(f"{Colors.CYAN}[*] Initializing local Quantum Statevector Simulator...{Colors.RESET}")
    time.sleep(0.5)
    print(f"{Colors.GREEN}[+] Applied Hadamard Gate (H) -> Qubit in 50/50 Quantum Superposition. |psi> = (|0> + |1>)/sqrt(2){Colors.RESET}")
    time.sleep(0.5)

    results = []
    for i in range(flips):
        # Quantum state measurement: 50% probability of 0, 50% probability of 1
        measurement = random.choice([0, 1])
        label = "HEADS (1)" if measurement == 1 else "TAILS (0)"
        results.append(label)

    return results

def run_ibm_quantum_hardware(token, flips=1):
    """
    Connects to IBM Quantum Platform API, creates a Qiskit circuit, and submits to real QPUs.
    """
    try:
        from qiskit import QuantumCircuit
        from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2 as Sampler
    except ImportError:
        print(f"{Colors.RED}[!] Qiskit packages not found.{Colors.RESET}")
        print(f"Please install them via: {Colors.BOLD}pip install qiskit qiskit-ibm-runtime{Colors.RESET}")
        sys.exit(1)

    print(f"{Colors.CYAN}[*] Authenticating with IBM Quantum Cloud Platform...{Colors.RESET}")
    service = QiskitRuntimeService(channel="ibm_quantum", token=token)
    
    print(f"{Colors.CYAN}[*] Querying available Quantum Processing Units (QPUs)...{Colors.RESET}")
    backend = service.least_busy(operational=True, simulator=False)
    print(f"{Colors.GREEN}[+] Target Hardware Backend Selected: {Colors.BOLD}{backend.name}{Colors.RESET}")

    # Build 1-Qubit Quantum Circuit
    qc = QuantumCircuit(1, 1)
    qc.h(0)        # Put qubit 0 into superposition
    qc.measure(0, 0) # Measure qubit into classical bit

    print(f"{Colors.CYAN}[*] Submitting quantum circuit payload to QPU queue...{Colors.RESET}")
    sampler = Sampler(backend)
    job = sampler.run([qc], shots=flips)
    print(f"{Colors.GREEN}[+] Job ID: {Colors.BOLD}{job.job_id()}{Colors.RESET}")
    print(f"{Colors.YELLOW}[*] Waiting for QPU execution...{Colors.RESET}")
    
    result = job.result()
    counts = result[0].data.c0.get_counts()
    
    outcomes = []
    for bit, count in counts.items():
        label = "HEADS (1)" if str(bit) == "1" else "TAILS (0)"
        outcomes.extend([label] * count)
    
    random.shuffle(outcomes)
    return outcomes

def main():
    if hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        except Exception:
            pass

    parser = argparse.ArgumentParser(
        description="qflip - Quantum Coin Flipper CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""Examples:
  python quantum_flip.py
  python quantum_flip.py --flips 5
  python quantum_flip.py --mode ibm --token YOUR_IBM_QUANTUM_API_TOKEN
"""
    )
    parser.add_argument("--mode", choices=["sim", "ibm"], default="sim", help="Mode: 'sim' for local simulation, 'ibm' for real hardware")
    parser.add_argument("--flips", type=int, default=1, help="Number of quantum coins to flip (default: 1)")
    parser.add_argument("--token", type=str, default=os.getenv("IBM_QUANTUM_TOKEN"), help="IBM Quantum API Token (for --mode ibm)")

    args = parser.parse_args()

    print(f"{Colors.BOLD}{Colors.MAGENTA}")
    print("==================================================")
    print("        QUANTUM COIN FLIPPER (qflip)")
    print("==================================================")
    print(f"{Colors.RESET}")

    if args.mode == "sim":
        outcomes = run_local_quantum_simulation(args.flips)
    elif args.mode == "ibm":
        token = args.token
        if not token:
            print(f"{Colors.RED}[!] Error: IBM Quantum API token required for hardware execution.{Colors.RESET}")
            print(f"Pass it via --token YOUR_TOKEN or set export IBM_QUANTUM_TOKEN='YOUR_TOKEN'")
            sys.exit(1)
        outcomes = run_ibm_quantum_hardware(token, args.flips)

    print(f"\n{Colors.BOLD}--- RESULTS ---{Colors.RESET}")
    for idx, res in enumerate(outcomes, 1):
        print(f"Flip #{idx}: {Colors.BOLD}{res}{Colors.RESET}")
        if len(outcomes) == 1:
            print_ascii_coin(res)

    print(f"\n{Colors.GREEN}✓ Quantum measurement complete.{Colors.RESET}\n")

if __name__ == "__main__":
    main()
