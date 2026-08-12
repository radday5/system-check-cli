# ⚛️ qflip - Quantum Coin Flipper CLI

A lightweight, novel CLI tool that flips a coin using quantum superposition on either a local Quantum Simulator or a **real IBM Quantum Computer**!

---

## 🚀 Quick Start

### 1. Run Local Quantum Simulation (Instant, No Setup Required)
Run the script directly using Python:

```bash
python quantum_flip.py
```

Flip multiple quantum coins at once:
```bash
python quantum_flip.py --flips 5
```

---

### 🌐 2. Submit to Real IBM Quantum Hardware

Want to run your coin flip on a physical quantum processor in IBM's datacenter?

1. **Sign up for a free account** at [IBM Quantum Platform](https://quantum.ibm.com/).
2. Copy your **API Token** from your IBM Quantum dashboard.
3. Install Qiskit:
   ```bash
   pip install qiskit qiskit-ibm-runtime
   ```
4. Run `quantum_flip.py` with your token:
   ```bash
   python quantum_flip.py --mode ibm --token "YOUR_IBM_QUANTUM_API_TOKEN"
   ```

---

## 🧬 How It Works (SysAdmin Summary)
1. **Quantum Superposition**: The script sends a Hadamard logic gate (`H`) to qubit 0, placing it into an equal 50/50 state of `0` and `1` simultaneously ($|\psi\rangle = \frac{|0\rangle + |1\rangle}{\sqrt{2}}$).
2. **Measurement**: When measured, the quantum wave function collapses to either `0` (Tails) or `1` (Heads).
3. **Execution**: On real hardware, physical quantum mechanics forces the outcome—no pseudo-random algorithms used!
