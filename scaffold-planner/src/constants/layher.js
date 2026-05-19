// Layher Allround stock definitions for Raven Staging scaffold planner

// Bay lengths (ledger spans) — metres
export const BAY_LENGTHS = [0.73, 1.09, 1.57, 2.07, 2.57];

// Bay widths — metres
export const BAY_WIDTHS = [2.07, 2.57];

// Standard tube heights — metres
export const STANDARD_HEIGHTS = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0];

// Rosette node interval — metres
export const NODE_INTERVAL = 0.5;

// Default standard stacking preference (longest first for minimum tube count)
export const DEFAULT_STACK = [3.0, 2.5, 2.0, 1.5, 1.0, 0.5];

// Allround aluminium pan dimensions
export const PAN_WIDTH = 0.32;         // metres — pan spans in bay-width direction
export const GAP_FILLER_WIDTH = 0.19;  // metres — gap filler used in 2.07m wide bays
export const PANS_PER_BAY_257 = 8;     // 8 × 0.32m = 2.56m (2.57m bay)
export const PANS_PER_BAY_207 = 6;     // 6 × 0.32m + 1 × 0.19m gap filler = 2.07m bay

export const SLOTS_PER_BAY_257 = 8;   // slot positions in 2.57m wide bay
export const SLOTS_PER_BAY_207 = 6;   // slot positions in 2.07m wide bay

// Tarp dimensions
// Physical unit is 2.5m tall, but the top 0.5m is an overlap flap that tucks behind the
// adjacent tarp or keder rail — display height is 2.0m (the visible, non-overlapping portion).
export const TARP_SIDE_HEIGHT = 2.0; // display height only; physical unit = 2.5m
export const TARP_BAY_WIDTH = 2.57;  // tarps only compatible with 2.57m bays

// Roof kit run-off each side (front and back)
export const ROOF_RUNOFF = 0.5;

// Ladder beam span — metres
export const LADDER_BEAM_SPAN = 5.0;

// Window heights — metres (0.5m increments)
export const WINDOW_HEIGHTS = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0];

// Window types
export const WINDOW_TYPES = ['viewport', 'projector'];

// Defaults
export const DEFAULT_BAY_LENGTH = 2.07;
export const DEFAULT_BAY_WIDTH = 2.57;
export const DEFAULT_STRUCTURE_HEIGHT = 4.0;

// Level colour palette (cycles if more than 6 levels)
export const LEVEL_COLORS = [
  '#C9A84C', // gold
  '#3b82f6', // blue
  '#22c55e', // green
  '#a855f7', // purple
  '#ef4444', // red
  '#06b6d4', // cyan
];

// Unit price list (£) for quote builder serialisation — description → price
export const PRICE_LIST = {
  // Standards (Layher Allround aluminium)
  '3m standard':    1.20,
  '2.5m standard':  1.20,
  '2m standard':    1.20,
  '1.5m standard':  1.20,
  '1m standard':    1.20,
  '0.5m standard':  1.20,
  // Ledgers / transoms
  '2.57m ledger':   0.67,
  '2.07m ledger':   0.67,
  '1.57m ledger':   0.67,
  '1.07m ledger':   0.67,
  // Diagonal braces (Layher Allround LW, 2.00m bay height)
  '3.18m diagonal brace (2.57m bay)': 0.67,   // ref 2683.257
  '2.81m diagonal brace (2.07m bay)': 0.67,   // ref 2683.207
  // Plan braces (O-ledger horizontal-diagonal)
  '3.64m plan brace (2.57 x 2.57m bay)': 0.67,  // ref 2678.257
  '3.30m plan brace (2.57 x 2.07m bay)': 0.67,  // ref 2678.255
  '2.93m plan brace (2.07 x 2.07m bay)': 0.67,  // ref 2678.207
  // Base hardware (per standard position)
  'Starting collars':                   0.52,
  'Base plate (spec per engineering)':  0.00,  // flagged for manual confirmation
  'Screw jack':                         0.66,
  // Deck pans
  '2.57m pan':  1.30,
  '2.07m pan':  1.30,
  // Cladding
  'Tarp set — 2.57m x 2.57m x 2m lift':  30.00,
  'Tarp set — 5m x 2.57m x 2m lift':     60.00,
  'Tarp set — 7.5m x 2.57m x 2m lift':   90.00,
  'Roof kit':       75.00,
  'Roof tarp':      22.00,
  'Apex tarp':      22.00,
  'Perspex window': 90.00,
};
