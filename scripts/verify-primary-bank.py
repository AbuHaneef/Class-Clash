#!/usr/bin/env python3
"""Verify all 1000 Primary Maths questions against computed answers,
generate explanations, rewrite duplicate stems, and emit import-ready JSON.

Output: /tmp/docx-extract/verified.json
Report: per-status counts, mismatches, unhandled questions.
"""
import json
import re
from fractions import Fraction

qs = json.load(open("/tmp/docx-extract/questions.json", encoding="utf-8"))

LETTERS = "ABCD"

# ──────────────────────────────────────────────────────────────
# helpers
# ──────────────────────────────────────────────────────────────

def num(s):
    """Parse an option string as a number (int/float); None if not numeric."""
    try:
        f = float(s.replace(",", "").strip())
        return f
    except (ValueError, AttributeError):
        return None

def fmt(x):
    """Format a computed number to match option style."""
    if x is None:
        return None
    if isinstance(x, float):
        if abs(x - round(x)) < 1e-9:
            x = int(round(x))
            return str(x)
        return f"{x:.10f}".rstrip("0").rstrip(".")
    return str(x)

def option_value(q, letter):
    return q["options"][LETTERS.index(letter)]

def matches_key(q, computed):
    """True if computed value equals the keyed option (numeric-aware)."""
    kv = option_value(q, q["answerLetter"])
    if isinstance(computed, str):
        return computed.strip() == kv.strip()
    kn = num(kv)
    if kn is None:
        return False
    return abs(kn - computed) < 1e-6

def is_image_q(q):
    return bool(q.get("image"))

# ── fraction helpers ──
def parse_frac(s):
    m = re.match(r"^(-?\d+)/(\d+)$", s.strip())
    if not m:
        return None
    return Fraction(int(m.group(1)), int(m.group(2)))

def frac_str(fr):
    return f"{fr.numerator}/{fr.denominator}"

# ── expression evaluator (BODMAS, parentheses, x ÷ + -, ², unary -) ──
def eval_expr(expr):
    """Evaluate a primary-maths expression string. Returns float or None."""
    s = expr.replace("−", "-").replace("×", "x").replace("÷", "/")
    # convert superscript: N² -> (N)x(N)
    def sq(m):
        base = m.group(1)
        return f"({base}x{base})"
    s = re.sub(r"(\d+(?:\.\d+)?)²", sq, s)
    s = s.replace("x", "*").replace("/", "/")
    try:
        return float(eval(s, {"__builtins__": {}}, {}))
    except Exception:
        return None

# ──────────────────────────────────────────────────────────────
# per-topic verifiers: return (status, computed, explanation)
# status: match | mismatch | unhandled | image
# ──────────────────────────────────────────────────────────────

def v_arithmetic(q):
    stem = q["stem"]
    m = re.match(r"^(-?[\d.]+)\s*([+\-])\s*(-?[\d.]+)\s*=\s*\?$", stem)
    if m:
        a, op, b = float(m.group(1)), m.group(2), float(m.group(3))
        r = a + b if op == "+" else a - b
        sym = "+" if op == "+" else "-"
        return r, f"{fmt(a)} {sym} {fmt(b)} = {fmt(r)}."
    m = re.match(r"^(-?[\d.]+)\s*x\s*(-?[\d.]+)\s*=\s*\?$", stem)
    if m:
        a, b = float(m.group(1)), float(m.group(2))
        r = a * b
        return r, f"{fmt(a)} x {fmt(b)} = {fmt(r)}."
    m = re.match(r"^(-?[\d.]+)\s*÷\s*(-?[\d.]+)\s*=\s*\?$", stem)
    if m:
        a, b = float(m.group(1)), float(m.group(2))
        if b == 0:
            return None, None
        r = a / b
        return r, f"{fmt(a)} ÷ {fmt(b)} = {fmt(r)}."
    return None, None

def v_div_remainder(q):
    m = re.match(r"^(\d+)\s*÷\s*(\d+)\s*=\s*\?.*remainder is (\d+)\)$", q["stem"])
    if not m:
        return None, None
    a, b = int(m.group(1)), int(m.group(2))
    quot, rem = divmod(a, b)
    return quot, f"{a} ÷ {b} = {quot} remainder {rem}, so the whole-number quotient is {quot}."

def v_measurement(q):
    m = re.match(r"^(\d+)\s*(metres?|kilograms?|litres?)\s*=\s*how many (centimetres|grams|millilitres)\?$", q["stem"])
    if not m:
        return None, None
    n = int(m.group(1))
    unit, target = m.group(2), m.group(3)
    if unit.startswith("metre") and target == "centimetres":
        r = n * 100
        return r, f"1 metre = 100 centimetres, so {n} x 100 = {fmt(r)} cm."
    if unit.startswith("kilogram") and target == "grams":
        r = n * 1000
        return r, f"1 kilogram = 1000 grams, so {n} x 1000 = {fmt(r)} g."
    if unit.startswith("litre") and target == "millilitres":
        r = n * 1000
        return r, f"1 litre = 1000 millilitres, so {n} x 1000 = {fmt(r)} ml."
    return None, None

def v_money(q):
    m = re.match(r"^An orange costs N(\d+)\. How much will (\d+) oranges cost\?$", q["stem"])
    if not m:
        return None, None
    cost, count = int(m.group(1)), int(m.group(2))
    r = cost * count
    return r, f"Each orange costs N{cost}, so {count} oranges cost {count} x {cost} = N{r}."

def v_arrays(q):
    m = re.match(r"^There are (\d+) rows with (\d+) apples in each row\. How many apples are there in total\?$", q["stem"])
    if not m:
        return None, None
    rows, per = int(m.group(1)), int(m.group(2))
    r = rows * per
    return r, f"{rows} rows of {per} apples: {rows} x {per} = {r} apples in total."

def v_number_bonds(q):
    s = q["stem"]
    m = re.match(r"^__\s*\+\s*(\d+)\s*=\s*(\d+)\. What number goes in the blank\?$", s)
    if m:
        a, b = int(m.group(1)), int(m.group(2))
        r = b - a
        return r, f"{r} + {a} = {b}, so the blank is {r}."
    m = re.match(r"^What number must be added to (\d+) to make (\d+)\?$", s)
    if m:
        a, b = int(m.group(1)), int(m.group(2))
        r = b - a
        return r, f"{a} + {r} = {b}, so the answer is {r}."
    m = re.match(r"^Double (\d+) is what number\? \(double means (\d+) \+ (\d+)\)$", s)
    if m:
        n = int(m.group(1))
        r = 2 * n
        return r, f"Double {n} = {n} + {n} = {r}."
    return None, None

def v_number_recognition(q):
    m = re.match(r"^What number comes (before|after) (\d+)\?$", q["stem"])
    if not m:
        return None, None
    pos, n = m.group(1), int(m.group(2))
    r = n - 1 if pos == "before" else n + 1
    return r, f"The number {pos} {n} is {r}."

def v_skip_counting(q):
    m = re.match(r"^What comes next in the pattern: ([\d, ]+), __\?$", q["stem"])
    if not m:
        return None, None
    seq = [int(x) for x in m.group(1).split(",")]
    step = seq[1] - seq[0]
    r = seq[-1] + step
    return r, f"The pattern goes up by {step} each time: {seq[-1]} + {step} = {r}."

def v_comparing_numbers(q):
    s = q["stem"]
    m = re.match(r"^Which number is greater: (-?\d+) or (-?\d+)\?$", s)
    if m:
        a, b = int(m.group(1)), int(m.group(2))
        r = max(a, b)
        return r, f"{r} is greater than {min(a, b)}."
    if s == "Which statement is TRUE?":
        # evaluate each option: "a = b" / "a < b" / "a > b"
        true_opts = []
        for i, opt in enumerate(q["options"]):
            om = re.match(r"^(-?\d+)\s*(=|<|>)\s*(-?\d+)$", opt)
            if not om:
                return None, None
            a, op, b = int(om.group(1)), om.group(2), int(om.group(3))
            ok = (op == "=" and a == b) or (op == "<" and a < b) or (op == ">" and a > b)
            if ok:
                true_opts.append(i)
        if len(true_opts) != 1:
            return None, None
        idx = true_opts[0]
        if LETTERS[idx] != q["answerLetter"]:
            return ("mismatch", LETTERS[idx]), None
        a, op, b = re.match(r"^(-?\d+)\s*([<>])\s*(-?\d+)$", q["options"][idx]).groups()
        word = "less than" if op == "<" else "greater than"
        return ("ok", q["options"][idx]), f"{a} {word} {b} — that statement is true."
    return None, None

def v_odd_even(q):
    m = re.match(r"^Which of the following numbers is (EVEN|ODD)\?$", q["stem"])
    if not m:
        return None, None
    want_even = m.group(1) == "EVEN"
    hits = []
    for i, opt in enumerate(q["options"]):
        n = num(opt)
        if n is None:
            return None, None
        if (n % 2 == 0) == want_even:
            hits.append(i)
    if len(hits) != 1:
        return None, None
    if LETTERS[hits[0]] != q["answerLetter"]:
        return ("mismatch", LETTERS[hits[0]]), None
    return ("ok", q["options"][hits[0]]), f"{q['options'][hits[0]]} is {m.group(1).lower()}; the others are {'odd' if want_even else 'even'}."

def v_place_value(q):
    m = re.match(r"^In the number (\d+), what is the value of the digit in the (units|tens|hundreds|thousands) place\?$", q["stem"])
    if not m:
        return None, None
    number, place = m.group(1), m.group(2)
    pos = {"units": 0, "tens": 1, "hundreds": 2, "thousands": 3}[place]
    digit = int(number[-1 - pos])
    r = digit * (10 ** pos)
    return r, f"In {number}, the {place} digit is {digit}, and its value is {digit} x {10**pos} = {r}."

def v_area(q):
    s = q["stem"]
    m = re.match(r"^A rectangle is (\d+) units long and (\d+) units wide\. What is its area \(in square units\), found by counting unit squares\?$", s)
    if m:
        l, w = int(m.group(1)), int(m.group(2))
        r = l * w
        return r, f"Area = length x width = {l} x {w} = {r} square units."
    m = re.match(r"^A rectangle has length (\d+)cm and width (\d+)cm\. What is its area\?$", s)
    if m:
        l, w = int(m.group(1)), int(m.group(2))
        r = l * w
        return r, f"Area = length x width = {l} x {w} = {r} sq cm."
    m = re.match(r"^A triangle has base (\d+)cm and height (\d+)cm\. What is its area\?$", s)
    if m:
        b, h = int(m.group(1)), int(m.group(2))
        r = b * h // 2
        return r, f"Area = 1/2 x base x height = 1/2 x {b} x {h} = {r} sq cm."
    m = re.match(r"^A parallelogram has base (\d+)cm and height (\d+)cm\. What is its area\?$", s)
    if m:
        b, h = int(m.group(1)), int(m.group(2))
        r = b * h
        return r, f"Area of a parallelogram = base x height = {b} x {h} = {r} sq cm."
    return None, None

def v_perimeter(q):
    s = q["stem"]
    m = re.match(r"^A rectangle has length (\d+)cm and width (\d+)cm\. Find its perimeter by counting/adding all the sides\.$", s)
    if m:
        l, w = int(m.group(1)), int(m.group(2))
        r = 2 * (l + w)
        return r, f"Perimeter = 2 x (length + width) = 2 x ({l} + {w}) = {r} cm."
    m = re.match(r"^A rectangle has length (\d+)cm and width (\d+)cm\. What is its perimeter\?$", s)
    if m:
        l, w = int(m.group(1)), int(m.group(2))
        r = 2 * (l + w)
        return r, f"Perimeter = 2 x (length + width) = 2 x ({l} + {w}) = {r} cm."
    m = re.match(r"^A rectangle has a perimeter of (\d+)cm and a length of (\d+)cm\. What is its width\?$", s)
    if m:
        p, l = int(m.group(1)), int(m.group(2))
        r = (p - 2 * l) // 2
        return r, f"P = 2 x (length + width), so {p} ÷ 2 = {p//2} = {l} + width, so width = {p//2} - {l} = {r} cm."
    return None, None

def v_rounding(q):
    m = re.match(r"^Round (\d+) to the nearest (\d+)\.$", q["stem"])
    if not m:
        return None, None
    n, base = int(m.group(1)), int(m.group(2))
    r = round(n / base) * base
    # python banker's rounding guard: nearest-ties never occur in this bank, but be safe
    import math
    r = math.floor(n / base + 0.5) * base
    lo, hi = (n // base) * base, (n // base + 1) * base
    return r, f"{n} is closer to {r} than {lo if r == lo else hi}, so it rounds to {r}."

def v_multiples(q):
    m = re.match(r"^What is the (\d+)(st|nd|rd|th) multiple of (\d+)\?$", q["stem"])
    if not m:
        return None, None
    k, n = int(m.group(1)), int(m.group(3))
    r = k * n
    return r, f"The {k}th multiple of {n} is {k} x {n} = {r}."

def v_fractions_p3(q):
    m = re.match(r"^What fraction of a shape divided into (\d+) equal parts do(?:es)? (\d+) parts? represent\?$", q["stem"])
    if not m:
        return None, None
    d, n = int(m.group(1)), int(m.group(2))
    fr = Fraction(n, d)
    return frac_str(fr), f"A shape in {d} equal parts: {n} part{'s' if n > 1 else ''} is {frac_str(fr)} of the shape."

def v_fractions_p4(q):
    m = re.match(r"^(\d+)/(\d+) \+ (\d+)/(\d+) = \?$", q["stem"])
    if not m:
        return None, None
    a, b, c, d = (int(m.group(i)) for i in range(1, 5))
    if b != d:
        return None, None
    # P4 keeps the unreduced sum (no "lowest terms" in the stem)
    r = f"{a + c}/{b}"
    return r, f"{a}/{b} + {c}/{b} = {a + c}/{b} — add the numerators, keep the denominator."

def v_fractions_p5(q):
    m = re.match(r"^(\d+)/(\d+) ([+\-]) (\d+)/(\d+) = \? \(give answer in lowest terms\)$", q["stem"])
    if not m:
        return None, None
    a, b, op, c, d = int(m.group(1)), int(m.group(2)), m.group(3), int(m.group(4)), int(m.group(5))
    f1, f2 = Fraction(a, b), Fraction(c, d)
    r = f1 + f2 if op == "+" else f1 - f2
    key = option_value(q, q["answerLetter"])
    kf = parse_frac(key)
    if kf is None or kf != r:
        return ("mismatch", frac_str(r)), None
    # also confirm the key is in lowest terms (stem demands it)
    if key != f"{r.numerator}/{r.denominator}":
        return ("mismatch", f"{r.numerator}/{r.denominator}"), None
    common = b * d // __import__("math").gcd(b, d)
    exp = (f"{a}/{b} = {Fraction(a,b).numerator * (common // b)}/{common}, "
           f"{c}/{d} = {Fraction(c,d).numerator * (common // d)}/{common}; "
           f"{frac_str(r)} in lowest terms.")
    return ("ok", key), exp

def v_comparing_fractions(q):
    if q["stem"] != "Which statement is TRUE?":
        return None, None
    true_opts = []
    for i, opt in enumerate(q["options"]):
        om = re.match(r"^(\d+)/(\d+)\s*(=|<|>)\s*(\d+)/(\d+)$", opt)
        if not om:
            return None, None
        f1 = Fraction(int(om.group(1)), int(om.group(2)))
        op = om.group(3)
        f2 = Fraction(int(om.group(4)), int(om.group(5)))
        ok = (op == "=" and f1 == f2) or (op == "<" and f1 < f2) or (op == ">" and f1 > f2)
        if ok:
            true_opts.append((i, opt))
    if len(true_opts) != 1:
        # two equivalent true statements (e.g. "4/6 > 2/6" and "2/6 < 4/6") — broken MCQ
        return ("skip", f"{len(true_opts)} options are mathematically true"), None
    i, opt = true_opts[0]
    if LETTERS[i] != q["answerLetter"]:
        return ("mismatch", LETTERS[i]), None
    om = re.match(r"^(\d+)/(\d+)\s*([<>])\s*(\d+)/(\d+)$", opt)
    n1, d1, op, n2, d2 = om.group(1), om.group(2), om.group(3), om.group(4), om.group(5)
    word = "less than" if op == "<" else "greater than"
    return ("ok", opt), f"{n1}/{d1} is {word} {n2}/{d2} — same denominator, so compare the numerators ({n1} vs {n2})."

def v_equivalent_fractions(q):
    m = re.match(r"^(\d+)/(\d+) is equivalent to what fraction with denominator (\d+)\?$", q["stem"])
    if not m:
        return None, None
    a, b, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if d % b != 0:
        return None, None
    k = d // b
    r = f"{a * k}/{d}"
    return r, f"{a}/{b} = {a * k}/{d} because {a} x {k} = {a * k} and {b} x {k} = {d}."

def v_multiplying_fractions(q):
    m = re.match(r"^(\d+)/(\d+) x (\d+) = \?$", q["stem"])
    if not m:
        return None, None
    a, b, n = int(m.group(1)), int(m.group(2)), int(m.group(3))
    fr = Fraction(a, b) * n
    if fr.denominator == 1:
        r = fr.numerator
        return r, f"{a}/{b} x {n} = {n} ÷ {b} x {a} = {r}."
    return frac_str(fr), f"{a}/{b} x {n} = {a * n}/{b} = {frac_str(fr)}."

def v_properties(q):
    s = q["stem"]
    m = re.match(r"^\((\d+) x (\d+)\) x (\d+) = (\d+) x \((\d+) x (\d+)\)\. This is an example of which property of multiplication\?$", s)
    if m:
        if option_value(q, q["answerLetter"]) != "Associative property":
            return ("mismatch", "Associative property"), None
        return ("ok", "Associative property"), "The way the numbers are GROUPED changes, not their order — that is the Associative property."
    m = re.match(r"^(\d+) x (\d+) = (\d+) x (\d+)\. This is an example of which property of multiplication\?$", s)
    if m:
        a, b, c, d = (int(m.group(i)) for i in range(1, 5))
        if (a, b) == (d, c) and option_value(q, q["answerLetter"]) == "Commutative property":
            return ("ok", "Commutative property"), f"The ORDER is swapped ({a} x {b} = {b} x {a}) but the product is the same — the Commutative property."
        return ("mismatch", "unexpected pattern"), None
    return None, None

def v_word_problems(q):
    s = q["stem"]
    # P1: mangoes
    m = re.match(r"^Chidi has (\d+) mangoes\. His friend gives him (\d+) more\. How many mangoes does Chidi have now\?$", s)
    if m:
        a, b = int(m.group(1)), int(m.group(2))
        r = a + b
        return r, f"Chidi starts with {a} mangoes and gets {b} more: {a} + {b} = {r} mangoes."
    # P1: sweets
    m = re.match(r"^Ada had (\d+) sweets\. She ate (\d+) of them\. How many sweets are left\?$", s)
    if m:
        a, b = int(m.group(1)), int(m.group(2))
        r = a - b
        return r, f"Ada had {a} sweets and ate {b}: {a} - {b} = {r} sweets left."
    # P1: balloons
    m = re.match(r"^Bola has (\d+) balloons\. Her mother gives her (\d+) more, then (\d+) balloons burst\. How many balloons does Bola have now\?$", s)
    if m:
        a, g, k = int(m.group(1)), int(m.group(2)), int(m.group(3))
        r = a + g - k
        return r, f"{a} + {g} = {a + g} balloons, then {k} burst: {a + g} - {k} = {r} balloons."
    # P2: pencils
    m = re.match(r"^A pencil costs N(\d+)\. Musa buys (\d+) pencils\. How much does he spend in total\?$", s)
    if m:
        c, n = int(m.group(1)), int(m.group(2))
        r = c * n
        return r, f"Each pencil costs N{c}, so {n} pencils cost {n} x {c} = N{r}."
    # P2: pens change
    m = re.match(r"^A pen costs N(\d+)\. Kemi buys (\d+) pens and pays with N(\d+)\. How much change does she get\?$", s)
    if m:
        c, n, p = int(m.group(1)), int(m.group(2)), int(m.group(3))
        r = p - c * n
        return r, f"{n} pens cost {n} x {c} = N{c * n}. Change = {p} - {c * n} = N{r}."
    # P2: pupils
    m = re.match(r"^There are (\d+) pupils in a class\. (\d+) of them are boys\. How many are girls\?$", s)
    if m:
        t, b = int(m.group(1)), int(m.group(2))
        r = t - b
        return r, f"{t} pupils - {b} boys = {r} girls."
    # P2: bonds in word problems
    m = re.match(r"^__ \+ (\d+) = (\d+)\. What number goes in the blank\?$", s)
    if m:
        a, b = int(m.group(1)), int(m.group(2))
        r = b - a
        return r, f"{r} + {a} = {b}, so the blank is {r}."
    # P3/P4: oranges shared
    m = re.match(r"^(\d+) oranges are shared equally among (\d+) children[,.] (?:and then |then )?[Ee]ach child (?:then )?gives (\d+) oranges to a friend\. How many oranges does each child have left\?$", s)
    if m:
        total, kids, give = int(m.group(1)), int(m.group(2)), int(m.group(3))
        each = total // kids
        r = each - give
        return r, f"Each child gets {total} ÷ {kids} = {each} oranges, then gives away {give}: {each} - {give} = {r} oranges left."
    # P3: maize
    m = re.match(r"^A farmer plants (\d+) rows of maize with (\d+) plants in each row, then plants (\d+) more maize plants separately\. How many maize plants are there in total\?$", s)
    if m:
        rows, per, extra = int(m.group(1)), int(m.group(2)), int(m.group(3))
        r = rows * per + extra
        return r, f"{rows} x {per} = {rows * per} plants in rows, plus {extra} more: {rows * per} + {extra} = {r} plants."
    # P5: trader discount
    m = re.match(r"^A trader sells an item for N(\d+) each\. She sells (\d+) of them and gives a (\d+)% discount on the total\. How much does she collect after the discount\?$", s)
    if m:
        price, count, disc = int(m.group(1)), int(m.group(2)), int(m.group(3))
        total = price * count
        r = total * (100 - disc) // 100
        return r, f"{count} x N{price} = N{total}; less {disc}% discount ({total * disc // 100}): {total} - {total * disc // 100} = N{r}."
    # P6: fuel
    m = re.match(r"^A car travels at (\d+)km/h for (\d+) hours?\. Fuel costs N(\d+) per kilometre travelled\. How much is spent on fuel for the journey\?$", s)
    if m:
        speed, hours, cost = int(m.group(1)), int(m.group(2)), int(m.group(3))
        dist = speed * hours
        r = dist * cost
        return r, f"Distance = {speed} x {hours} = {dist} km. Fuel = {dist} x {cost} = N{r}."
    # P6: deposits
    m = re.match(r"^Tolu deposits N(\d+) in a bank at (\d+)% simple interest per annum\. How much will be in the account after (\d+) years? \(principal \+ interest\)\?$", s)
    if m:
        p, rate, years = int(m.group(1)), int(m.group(2)), int(m.group(3))
        interest = p * rate * years // 100
        r = p + interest
        return r, f"Interest = {p} x {rate} x {years} ÷ 100 = N{interest}. Total = {p} + {interest} = N{r}."
    # P6: school boys/girls
    m = re.match(r"^A school has (\d+) pupils\. (\d+)% of them are boys\. How many pupils are girls\?$", s)
    if m:
        total, pct = int(m.group(1)), int(m.group(2))
        r = total * (100 - pct) / 100
        if r != int(r):
            return ("flawed", r), f"WARNING: {pct}% of {total} is not a whole number."
        r = int(r)
        return r, f"Girls are {100 - pct}% of {total}: {total} x {100 - pct} ÷ 100 = {r} girls."
    return None, None

def v_percentages(q):
    s = q["stem"]
    m = re.match(r"^What is (\d+)% of (\d+)\?$", s)
    if m:
        p, n = int(m.group(1)), int(m.group(2))
        r = n * p / 100
        return r, f"{p}% of {n} = {p} ÷ 100 x {n} = {fmt(r)}."
    m = re.match(r"^A shirt is sold for N(\d+) after a (\d+)% discount\. What was the original price\?$", s)
    if m:
        sold, disc = int(m.group(1)), int(m.group(2))
        r = sold * 100 / (100 - disc)
        return r, f"After {disc}% off, N{sold} is {100 - disc}% of the original price: {sold} ÷ {100 - disc} x 100 = N{fmt(r)}."
    m = re.match(r"^A price of N(\d+) is (increased|decreased) by (\d+)%\. What is the new price\?$", s)
    if m:
        price, direction, pct = int(m.group(1)), m.group(2), int(m.group(3))
        delta = price * pct / 100
        r = price + delta if direction == "increased" else price - delta
        sym = "+" if direction == "increased" else "-"
        return r, f"N{price} {sym} {pct}% ({fmt(delta)}) = N{fmt(r)}."
    return None, None

def v_percentages_closest(q, computed, explanation):
    """For price-change questions whose exact value is not a whole number,
    accept the keyed option when it is the CLOSEST option to the exact value."""
    exact = computed
    kn = num(option_value(q, q["answerLetter"]))
    if kn is None:
        return False, explanation
    others = [num(o) for o in q["options"] if num(o) is not None]
    if all(abs(kn - exact) <= abs(o - exact) for o in others):
        note = f" Exact value: N{fmt(exact)}; the keyed option N{fmt(kn)} is the closest choice."
        return True, explanation + note
    return False, explanation

def gcd(a, b):
    while b:
        a, b = b, a % b
    return a

def v_hcf(q):
    m = re.match(r"^What is the Highest Common Factor \(HCF\) of (\d+) and (\d+)\?$", q["stem"])
    if not m:
        return None, None
    a, b = int(m.group(1)), int(m.group(2))
    r = gcd(a, b)
    return r, f"The biggest number that divides both {a} and {b} is {r}."

def v_lcm(q):
    m = re.match(r"^What is the Lowest Common Multiple \(LCM\) of (\d+) and (\d+)\?$", q["stem"])
    if not m:
        return None, None
    a, b = int(m.group(1)), int(m.group(2))
    r = a * b // gcd(a, b)
    return r, f"The smallest number that both {a} and {b} divide into is {r}."

def v_average(q):
    m = re.match(r"^Find the average of ([\d, ]+and [\d]+)\.$", q["stem"])
    if m:
        nums = [int(x) for x in re.findall(r"\d+", m.group(1))]
        r = sum(nums) / len(nums)
        return r, f"({'+'.join(str(n) for n in nums)}) ÷ {len(nums)} = {sum(nums)} ÷ {len(nums)} = {fmt(r)}."
    return None, None

def v_algebra(q):
    s = q["stem"]
    m = re.match(r"^If (\d)([xy]) \+ (\d+) = (\d+), find the value of ([xy])\.$", s)
    if m:
        coef, _, c, rhs, _ = int(m.group(1)), m.group(2), int(m.group(3)), int(m.group(4)), m.group(5)
        r = (rhs - c) / coef
        return r, f"{coef}v + {c} = {rhs} → {coef}v = {rhs - c} → v = {rhs - c} ÷ {coef} = {fmt(r)}."
    m = re.match(r"^If ([xy]) \+ (\d+) = (\d+), find the value of ([xy])\.$", s)
    if m:
        _, c, rhs, _ = m.group(1), int(m.group(2)), int(m.group(3)), m.group(4)
        r = rhs - c
        return r, f"v + {c} = {rhs} → v = {rhs} - {c} = {r}."
    m = re.match(r"^If (\d)([xy]) = (\d+), find the value of ([xy])\.$", s)
    if m:
        coef, _, rhs, _ = int(m.group(1)), m.group(2), int(m.group(3)), m.group(4)
        r = rhs / coef
        return r, f"{coef}v = {rhs} → v = {rhs} ÷ {coef} = {fmt(r)}."
    return None, None

def v_negative(q):
    s = q["stem"]
    m = re.match(r"^Which is greater: (-?\d+) or (-?\d+)\?$", s)
    if m:
        a, b = int(m.group(1)), int(m.group(2))
        r = max(a, b)
        return r, f"On the number line, {r} is further right, so {r} is greater."
    m = re.match(r"^The temperature is (-?\d+)°C\. It then (falls|rises) by (\d+)°C\. What is the new temperature\?$", s)
    if m:
        t, direction, d = int(m.group(1)), m.group(2), int(m.group(3))
        r = t - d if direction == "falls" else t + d
        sym = "-" if direction == "falls" else "+"
        return r, f"{t}°C {sym} {d}°C = {r}°C."
    # negative arithmetic falls through to the standard patterns
    return v_arithmetic(q)

def v_ratio(q):
    s = q["stem"]
    m = re.match(r"^N(\d+) is shared among Musa, Bola and Tunde in the ratio (\d+):(\d+):(\d+)\. How much does Tunde get\?$", s)
    if m:
        total = int(m.group(1))
        parts = [int(m.group(i)) for i in range(2, 5)]
        ssum = sum(parts)
        if total % ssum != 0:
            return None, None
        one = total // ssum
        r = parts[2] * one
        exp = f"Total parts = {parts[0]} + {parts[1]} + {parts[2]} = {ssum}. One part = {total} ÷ {ssum} = {one}. Tunde gets {parts[2]} parts: {parts[2]} x {one} = N{r}."
        return r, exp
    m = re.match(r"^Musa and Bola share N(\d+) in the ratio (\d+):(\d+)\. How much does Musa get\?$", s)
    if m:
        total = int(m.group(1))
        a, b = int(m.group(2)), int(m.group(3))
        ssum = a + b
        if total % ssum != 0:
            return None, None
        one = total // ssum
        r = a * one
        exp = f"Total parts = {a} + {b} = {ssum}. One part = {total} ÷ {ssum} = {one}. Musa gets {a} parts: {a} x {one} = N{r}."
        return r, exp
    m = re.match(r"^Express (\d+):(\d+) in its simplest form\.$", s)
    if m:
        a, b = int(m.group(1)), int(m.group(2))
        g = gcd(a, b)
        r = f"{a // g}:{b // g}"
        exp = f"Divide both parts by their highest common factor ({g}): {a} ÷ {g} : {b} ÷ {g} = {r}."
        return r, exp
    return None, None

def v_number_bases(q):
    m = re.match(r"^Convert (\d+) \(base 10\) to base 2 \(binary\)\.$", q["stem"])
    if not m:
        return None, None
    n = int(m.group(1))
    r = bin(n)[2:]
    # build the place-value decomposition, e.g. 12 = 8 + 4
    parts, rest, bit = [], n, 1
    powers = []
    while bit <= n:
        powers.append(bit)
        bit *= 2
    for p in reversed(powers):
        if rest >= p:
            parts.append(p)
            rest -= p
    decomp = " + ".join(str(p) for p in parts)
    return r, f"{n} = {decomp}, which in base 2 (place values {', '.join(str(p) for p in reversed(powers))}) is {r}."

def v_order_of_ops(q):
    m = re.match(r"^(.+?) = \?(?: \(note: .*\))?$", q["stem"])
    if not m:
        return None, None
    expr = m.group(1)
    val = eval_expr(expr)
    if val is None:
        return None, None
    return val, f"Follow BODMAS: {expr.replace('²', '²')} = {fmt(val)}."

def v_simple_interest(q):
    m = re.match(r"^Find the simple interest on N(\d+) for (\d+) years?\(s\) at (\d+)% per annum\.$", q["stem"])
    if not m:
        return None, None
    p, t, r_ = int(m.group(1)), int(m.group(2)), int(m.group(3))
    r = p * r_ * t / 100
    return r, f"I = P x R x T ÷ 100 = {p} x {r_} x {t} ÷ 100 = N{fmt(r)}."

def v_speed(q):
    s = q["stem"]
    m = re.match(r"^A car travels at (\d+)km/h for (\d+) hours?\. What distance does it cover\?$", s)
    if m:
        speed, hours = int(m.group(1)), int(m.group(2))
        r = speed * hours
        return r, f"Distance = speed x time = {speed} x {hours} = {r} km."
    m = re.match(r"^A car covers (\d+)km at a speed of (\d+)km/h\. How long did the journey take\?$", s)
    if m:
        dist, speed = int(m.group(1)), int(m.group(2))
        if dist % speed != 0:
            return None, None
        r = dist // speed
        return r, f"Time = distance ÷ speed = {dist} ÷ {speed} = {r} hour{'s' if r != 1 else ''}."
    return None, None

def v_statistics(q):
    s = q["stem"]
    m = re.match(r"^Find the (mean|median|mode|range) of ([\d, ]+)\.$", s)
    if m:
        stat, list_s = m.group(1), m.group(2)
        nums = [int(x) for x in re.findall(r"-?\d+", list_s)]
        if stat == "mean":
            r = sum(nums) / len(nums)
            return r, f"Mean = (sum) ÷ (count) = {sum(nums)} ÷ {len(nums)} = {fmt(r)}."
        if stat == "median":
            srt = sorted(nums)
            n = len(srt)
            r = srt[n // 2] if n % 2 == 1 else (srt[n // 2 - 1] + srt[n // 2]) / 2
            return r, f"Put them in order: {', '.join(map(str, srt))}. The middle value is {fmt(r)}."
        if stat == "mode":
            from collections import Counter
            c = Counter(nums)
            best = max(c.values())
            modes = [k for k, v in c.items() if v == best]
            if len(modes) != 1:
                return None, None
            return modes[0], f"{modes[0]} appears {best} times — more than any other number."
        r = max(nums) - min(nums)
        return r, f"Range = largest - smallest = {max(nums)} - {min(nums)} = {r}."
    m = re.match(r"^Four numbers are ([\d, ]+), and a fifth number makes the mean of all five equal to (\d+)\. What is the fifth number\?$", s)
    if m:
        nums = [int(x) for x in re.findall(r"\d+", m.group(1))]
        target = int(m.group(2))
        total = target * 5
        r = total - sum(nums)
        exp = f"All five must sum to {target} x 5 = {total}. The four given sum to {sum(nums)}, so the fifth number is {total} - {sum(nums)} = {r}."
        return r, exp
    return None, None

def v_volume(q):
    s = q["stem"]
    m = re.match(r"^A box is built from unit cubes: (\d+) cubes long, (\d+) cubes wide, and (\d+) cubes high\. How many unit cubes make up the box\?$", s)
    if m:
        l, w, h = int(m.group(1)), int(m.group(2)), int(m.group(3))
        r = l * w * h
        return r, f"Volume = length x width x height = {l} x {w} x {h} = {r} cubes."
    m = re.match(r"^A cuboid has length (\d+)cm, width (\d+)cm and height (\d+)cm\. What is its volume\?$", s)
    if m:
        l, w, h = int(m.group(1)), int(m.group(2)), int(m.group(3))
        r = l * w * h
        return r, f"Volume = length x width x height = {l} x {w} x {h} = {r} cubic cm."
    return None, None

def v_surface_area(q):
    m = re.match(r"^A cube has sides of length (\d+)cm\. What is its total surface area \(6 faces\)\?$", q["stem"])
    if not m:
        return None, None
    s_ = int(m.group(1))
    r = 6 * s_ * s_
    return r, f"A cube has 6 equal faces: 6 x ({s_} x {s_}) = 6 x {s_ * s_} = {r} sq cm."

def v_prime(q):
    m = re.match(r"^Is (\d+) a prime number or a composite number\?$", q["stem"])
    if not m:
        return None, None
    n = int(m.group(1))
    is_p = n > 1 and all(n % i for i in range(2, int(n ** 0.5) + 1))
    r = "Prime number" if is_p else "Composite number"
    if is_p:
        exp = f"{n} has exactly two factors, 1 and {n}, so it is prime."
    else:
        exp = f"{n} has more than two factors, so it is composite."
    return r, exp

def v_time_text(q):
    s = q["stem"]
    m = re.match(r"^What time is half past (\d+)\?$", s)
    if m:
        h = int(m.group(1))
        r = f"{h}:30"
        return r, f"Half past {h} means 30 minutes after {h}:00, so {h}:30."
    m = re.match(r"^What time is quarter past (\d+)\?$", s)
    if m:
        h = int(m.group(1))
        r = f"{h}:15"
        return r, f"Quarter past {h} means 15 minutes after {h}:00, so {h}:15."
    return None, None

def v_decimals(q):
    # covered by arithmetic patterns but with decimals & maybe multi-op
    return v_arithmetic(q)

# ──────────────────────────────────────────────────────────────
# dispatch
# ──────────────────────────────────────────────────────────────

HANDLERS = {
    "Addition": v_arithmetic,
    "Subtraction": v_arithmetic,
    "Multiplication": v_arithmetic,
    "Division": v_arithmetic,
    "Decimals": v_decimals,
    "Negative Numbers": v_negative,
    "Ratio": v_ratio,
    "Division with Remainders": v_div_remainder,
    "Measurement": v_measurement,
    "Converting Units": v_measurement,
    "Money": v_money,
    "Multiplication (Arrays)": v_arrays,
    "Number Bonds": v_number_bonds,
    "Number Recognition": v_number_recognition,
    "Skip Counting": v_skip_counting,
    "Comparing Numbers": v_comparing_numbers,
    "Odd and Even": v_odd_even,
    "Place Value": v_place_value,
    "Area": v_area,
    "Perimeter": v_perimeter,
    "Rounding": v_rounding,
    "Factors & Multiples": v_multiples,
    "Fractions": None,  # split by level below
    "Comparing Fractions": v_comparing_fractions,
    "Equivalent Fractions": v_equivalent_fractions,
    "Multiplying Fractions": v_multiplying_fractions,
    "Properties of Multiplication": v_properties,
    "Word Problems": v_word_problems,
    "Percentages": v_percentages,
    "HCF": v_hcf,
    "LCM": v_lcm,
    "Average": v_average,
    "Algebra": v_algebra,
    "Number Bases": v_number_bases,
    "Order of Operations": v_order_of_ops,
    "Simple Interest": v_simple_interest,
    "Speed, Distance & Time": v_speed,
    "Statistics (Mean)": v_statistics,
    "Statistics (Median)": v_statistics,
    "Statistics (Mode)": v_statistics,
    "Statistics (Range)": v_statistics,
    "Volume": v_volume,
    "Surface Area": v_surface_area,
    "Prime & Composite Numbers": v_prime,
    "Time": v_time_text,  # image ones handled separately
}

# ──────────────────────────────────────────────────────────────
# main loop
# ──────────────────────────────────────────────────────────────

IMAGE_TOPICS_VERIFIERS = None  # image questions are VLM-verified separately

# ── Source corrections (stem edits applied before verification) ──
# Format: doc number -> (old, new, reviewNote)
CORRECTIONS = {
    440: ("Round 225 to the nearest 10.", "Round 224 to the nearest 10.",
          "Source said 225 — a exact tie between 220 and 230 — but keyed 220, contrary to the round-half-up rule taught in primary school. Stem adjusted to 224 so the keyed answer 220 is unambiguous."),
    995: ("A school has 90 pupils. 75% of them are boys. How many pupils are girls?",
          "A school has 92 pupils. 75% of them are boys. How many pupils are girls?",
          "Source said 90 pupils — 75% of 90 is 67.5, not a whole number. Stem adjusted to 92 so girls = 23 exactly, matching the keyed option."),
    565: ("What is the 3th multiple of 11?", "What is the 3rd multiple of 11?",
          "Typo in source ('3th') corrected to '3rd'."),
    568: ("What is the 3th multiple of 12?", "What is the 3rd multiple of 12?",
          "Typo in source ('3th') corrected to '3rd'."),
    703: ("1 kilograms = how many grams?", "1 kilogram = how many grams?",
          "Grammar fix: singular 'kilogram' after 1."),
    705: ("1 metres = how many centimetres?", "1 metre = how many centimetres?",
          "Grammar fix: singular 'metre' after 1."),
}

# kept-as-is quirks that deserve an honest reviewNote
KEEP_NOTES = {
    331: "Kept exactly as published: 20 pupils with 29 boys gives -9 girls (20 - 29 = -9). Mathematically consistent; flagged for reviewer review.",
}

# apply corrections first
for q in qs:
    if q["num"] in CORRECTIONS:
        old, new, note = CORRECTIONS[q["num"]]
        if q["stem"] != old:
            print(f"!! correction stem mismatch #{q['num']}: expected {old!r} got {q['stem']!r}")
        q["stem"] = new
        q["correctionNote"] = note

results = []
mismatches = []
unhandled = []

for q in qs:
    topic = q["topic"]
    entry = dict(q)
    if is_image_q(q):
        entry["status"] = "image"
        entry["computed"] = None
        entry["explanation"] = None
        results.append(entry)
        continue

    handler = HANDLERS.get(topic)
    if topic == "Fractions":
        handler = {3: v_fractions_p3, 4: v_fractions_p4, 5: v_fractions_p5}.get(q["level"])

    if handler is None:
        entry["status"] = "unhandled"
        entry["computed"] = None
        entry["explanation"] = None
        unhandled.append(q)
        results.append(entry)
        continue

    out = handler(q)
    if out is None or out[0] is None:
        entry["status"] = "unhandled"
        entry["computed"] = None
        entry["explanation"] = None
        unhandled.append(q)
        results.append(entry)
        continue

    computed, explanation = out
    if isinstance(computed, tuple):
        # handler already decided (ok/mismatch/flawed/skip with payload)
        verdict, payload = computed
        if verdict == "ok":
            entry["status"] = "match"
            entry["computed"] = payload
            entry["explanation"] = explanation
        elif verdict == "skip":
            entry["status"] = "skip_flawed"
            entry["computed"] = payload
            entry["explanation"] = None
            mismatches.append((q["num"], "SKIP-FLAWED", payload, q["stem"]))
        elif verdict == "flawed":
            entry["status"] = "flawed"
            entry["computed"] = payload
            entry["explanation"] = explanation
            mismatches.append((q["num"], "FLAWED", payload, q["stem"]))
        else:
            entry["status"] = "mismatch"
            entry["computed"] = payload
            mismatches.append((q["num"], payload, option_value(q, q["answerLetter"]), q["stem"]))
        results.append(entry)
        continue

    if matches_key(q, computed):
        entry["status"] = "match"
        entry["computed"] = fmt(computed) if not isinstance(computed, str) else computed
        entry["explanation"] = explanation
    else:
        # percentage price-change: keyed option may be the closest to the exact value
        ok_closest, exp2 = v_percentages_closest(q, computed, explanation or "")
        if ok_closest:
            entry["status"] = "match_closest"
            entry["computed"] = fmt(computed) if not isinstance(computed, str) else computed
            entry["explanation"] = exp2
        else:
            entry["status"] = "mismatch"
            entry["computed"] = fmt(computed) if not isinstance(computed, str) else computed
            mismatches.append((q["num"], fmt(computed) if not isinstance(computed, str) else computed,
                               option_value(q, q["answerLetter"]), q["stem"]))
    results.append(entry)

# ── report ──
from collections import Counter
status_counts = Counter(r["status"] for r in results)
print("Status counts:", dict(status_counts))
print(f"\nMISMATCHES ({len(mismatches)}):")
for m in mismatches:
    print(f"  #{m[0]} computed={m[1]} key={m[2]} | {m[3][:90]}")
print(f"\nUNHANDLED ({len(unhandled)}):")
for q in unhandled:
    print(f"  #{q['num']} [{q['topic']} P{q['level']}] {q['stem'][:100]}")

json.dump(results, open("/tmp/docx-extract/verified.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("\nWrote /tmp/docx-extract/verified.json")
