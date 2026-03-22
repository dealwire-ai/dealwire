"""
Bohopo Hotel Acquisition Intelligence Dashboard
A demo for identifying underperforming boutique hotels in EU city centers.
"""

import json
import math
import os
from pathlib import Path

import markdown as md_lib
from openai import OpenAI
import pandas as pd
import streamlit as st
from dotenv import load_dotenv

load_dotenv()

# ──────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────

st.set_page_config(
    page_title="Bohopo | Hotel Acquisition Intelligence",
    page_icon="🏨",
    layout="wide",
    initial_sidebar_state="expanded",
)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

SYSTEM_PROMPT = """You are a hotel acquisition analyst for Bohopo, a boutique hotel investor targeting underperforming properties in European city centers.

Bohopo's acquisition criteria:
- Small boutique hotels: 20-50 rooms
- City center locations in Athens, Thessaloniki, Marseille, Brussels, Porto, and similar European markets
- Underperforming operators: low ratings (below 3.7) with substantial review volume (100+ reviews)
- Price level 2-3 (mid-range, not budget chains or luxury)
- Goal: acquire, redesign, and operate as upscale boutique properties

You have hotel data including: name, city, rating (1-5 stars), review count, price level, room count, average nightly rate (EUR), sub-ratings (cleanliness, service, location, value), review trend, and acquisition score (0-100, where higher = stronger acquisition signal based on low rating + high review confidence + room count fit).

Score interpretation:
- 70-100: 🔴 Priority target -- consistently bad operator, high review confidence, strong acquisition signal
- 40-69: 🟡 Watch list -- some signal, monitor for distress or ownership change
- 0-39: 🟢 Healthy -- not an acquisition candidate

When asked for targets, return a ranked list (top 3-5) with 1-2 sentences of reasoning per property. Be specific: reference the rating, review count, room count, nightly rate, and what the signal implies about the operator. Keep responses concise and actionable."""

DATA_DIR = Path(__file__).parent / "data"

CITY_FLAGS = {
    "Athens": "🇬🇷",
    "Thessaloniki": "🇬🇷",
    "Marseille": "🇫🇷",
    "Brussels": "🇧🇪",
    "Porto": "🇵🇹",
}

PRICE_LABELS = {1: "$", 2: "$$", 3: "$$$", 4: "$$$$"}

TREND_ICONS = {
    "declining": '<span style="color:#ef4444" title="Declining">▼</span>',
    "flat": '<span style="color:#6b7280" title="Flat">—</span>',
    "improving": '<span style="color:#22c55e" title="Improving">▲</span>',
}


def rating_change_html(change: float) -> str:
    if change <= -0.2:
        color = "#ef4444"
        icon = "▼"
    elif change < 0:
        color = "#f87171"
        icon = "▼"
    elif change == 0:
        color = "#4b5563"
        icon = "—"
    elif change < 0.2:
        color = "#4ade80"
        icon = "▲"
    else:
        color = "#22c55e"
        icon = "▲"
    sign = "+" if change > 0 else ""
    return f'<span style="color:{color};font-family:\'SF Mono\',Consolas,monospace;font-size:0.78rem">{icon} {sign}{change:.2f}</span>'


# ──────────────────────────────────────────────
# Data loading
# ──────────────────────────────────────────────

@st.cache_data
def load_all_hotels() -> pd.DataFrame:
    frames = []
    for city_file in sorted(DATA_DIR.glob("*.json")):
        with open(city_file) as f:
            hotels = json.load(f)
        frames.append(pd.DataFrame(hotels))
    if not frames:
        st.error("No hotel data found. Run `python generate_data.py` first.")
        st.stop()
    return pd.concat(frames, ignore_index=True)


# ──────────────────────────────────────────────
# Score badge
# ──────────────────────────────────────────────

def score_badge(score: int) -> str:
    mono = "font-family:'JetBrains Mono','SF Mono',Consolas,monospace"
    if score >= 70:
        return f'<span style="background:#7f1d1d;color:#fca5a5;padding:2px 8px;border-radius:3px;font-weight:600;font-size:0.75rem;{mono}">{score}</span>'
    elif score >= 40:
        return f'<span style="background:#78350f;color:#fcd34d;padding:2px 8px;border-radius:3px;font-weight:600;font-size:0.75rem;{mono}">{score}</span>'
    else:
        return f'<span style="background:#14532d;color:#86efac;padding:2px 8px;border-radius:3px;font-weight:600;font-size:0.75rem;{mono}">{score}</span>'


def rating_html(rating: float) -> str:
    if rating < 3.0:
        color = "#f87171"
    elif rating < 3.7:
        color = "#fbbf24"
    else:
        color = "#52525b"
    return f'<span style="color:{color};font-weight:500;font-family:\'JetBrains Mono\',monospace;font-size:0.82rem">{rating}</span>'


def sub_ratings_tooltip(row) -> str:
    return (
        f'<span title="Cleanliness: {row["cleanliness_rating"]}  |  '
        f'Service: {row["service_rating"]}  |  '
        f'Location: {row["location_rating"]}  |  '
        f'Value: {row["value_rating"]}" '
        f'style="cursor:help;border-bottom:1px dotted #4b5563">'
        f'{rating_html(row["rating"])}</span>'
    )


# ──────────────────────────────────────────────
# Styles
# ──────────────────────────────────────────────

st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

    /* Hide Streamlit chrome */
    #MainMenu, footer, header {visibility: hidden;}
    .stDeployButton {display: none;}

    /* App background */
    .stApp {background: #09090b; font-family: 'Inter', -apple-system, sans-serif;}
    section[data-testid="stSidebar"] {background: #0c0c0e !important; border-right: 1px solid #1a1a1f;}

    /* Header */
    .bohopo-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 0 20px 0;
        border-bottom: 1px solid #1a1a1f;
        margin-bottom: 20px;
    }
    .bohopo-logo {
        font-size: 1.1rem;
        font-weight: 600;
        letter-spacing: 0.14em;
        color: #a1a1aa;
        text-transform: uppercase;
        font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
    }
    .bohopo-tagline {
        font-size: 0.7rem;
        color: #3f3f46;
        margin-top: 4px;
        letter-spacing: 0.06em;
        font-family: 'JetBrains Mono', monospace;
    }
    .bohopo-badge {
        background: transparent;
        border: 1px solid #27272a;
        color: #52525b;
        padding: 3px 10px;
        border-radius: 4px;
        font-size: 0.62rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-family: 'JetBrains Mono', monospace;
    }
    .bohopo-refreshed {
        font-size: 0.62rem;
        color: #22c55e;
        margin-top: 6px;
        letter-spacing: 0.04em;
        font-family: 'JetBrains Mono', monospace;
        opacity: 0.7;
    }

    /* Stats cards — st.metric overrides */
    [data-testid="stMetric"] {
        background: #0c0c0e;
        border: 1px solid #1a1a1f;
        border-radius: 6px;
        padding: 14px 16px;
    }
    [data-testid="stMetricLabel"] {
        font-size: 0.62rem !important;
        color: #3f3f46 !important;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-family: 'JetBrains Mono', monospace !important;
    }
    [data-testid="stMetricValue"] {
        font-size: 1.5rem !important;
        font-weight: 600 !important;
        color: #e4e4e7 !important;
        font-family: 'JetBrains Mono', monospace !important;
    }
    [data-testid="stMetricDelta"] {
        font-family: 'JetBrains Mono', monospace !important;
        font-size: 0.68rem !important;
    }

    /* Table */
    .hotel-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.82rem;
        font-family: 'Inter', sans-serif;
    }
    .hotel-table th {
        text-align: left;
        padding: 8px 12px;
        font-size: 0.6rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #3f3f46;
        border-bottom: 1px solid #1a1a1f;
        font-weight: 500;
        font-family: 'JetBrains Mono', monospace;
    }
    .hotel-table td {
        padding: 9px 12px;
        color: #a1a1aa;
        border-bottom: 1px solid #111113;
        vertical-align: middle;
        font-size: 0.82rem;
    }
    .hotel-table tr:hover td {background: #0f0f12;}
    .hotel-name-link {
        color: #71717a;
        text-decoration: none;
        font-weight: 500;
        transition: color 0.15s;
    }
    .hotel-name-link:hover {color: #d4d4d8; text-decoration: none;}
    .city-cell {color: #52525b; font-size: 0.78rem;}
    .review-count {color: #3f3f46; font-family: 'JetBrains Mono', monospace; font-size: 0.78rem;}

    /* Section title */
    .section-title {
        font-size: 0.6rem;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: #3f3f46;
        margin: 24px 0 10px 0;
        display: flex;
        align-items: center;
        gap: 10px;
        font-family: 'JetBrains Mono', monospace;
    }
    .section-title::after {
        content: '';
        flex: 1;
        height: 1px;
        background: #18181b;
    }

    /* Chat */
    .chat-container {
        background: #0c0c0e;
        border: 1px solid #1a1a1f;
        border-radius: 6px;
        padding: 18px;
        min-height: 100px;
    }
    .chat-response {
        color: #a1a1aa;
        line-height: 1.7;
        font-size: 0.85rem;
    }
    .chat-response strong { color: #e4e4e7; }
    .chat-response ol, .chat-response ul { padding-left: 1.25rem; margin: 8px 0; }
    .chat-response li { margin: 6px 0; }
    .chat-response p { margin: 6px 0; }

    /* Sidebar labels */
    .stSelectbox label, .stMultiSelect label, .stSlider label, .stNumberInput label {
        color: #52525b !important;
        font-size: 0.68rem !important;
        text-transform: uppercase !important;
        letter-spacing: 0.06em !important;
        font-family: 'JetBrains Mono', monospace !important;
    }

    /* Scrollbar */
    ::-webkit-scrollbar {width: 4px;}
    ::-webkit-scrollbar-track {background: transparent;}
    ::-webkit-scrollbar-thumb {background: #27272a; border-radius: 2px;}
    ::-webkit-scrollbar-thumb:hover {background: #3f3f46;}

    /* Button overrides for suggestion chips */
    .stButton > button {
        background: #0c0c0e !important;
        border: 1px solid #1a1a1f !important;
        color: #52525b !important;
        font-size: 0.75rem !important;
        font-family: 'Inter', sans-serif !important;
        border-radius: 4px !important;
        transition: all 0.15s !important;
    }
    .stButton > button:hover {
        border-color: #27272a !important;
        color: #a1a1aa !important;
        background: #111113 !important;
    }
</style>
""", unsafe_allow_html=True)


# ──────────────────────────────────────────────
# Load data
# ──────────────────────────────────────────────

df_all = load_all_hotels()

# ──────────────────────────────────────────────
# Sidebar filters
# ──────────────────────────────────────────────

with st.sidebar:
    st.markdown("""
        <div style="padding: 16px 0 20px 0;">
            <div style="font-size:0.58rem;color:#3f3f46;text-transform:uppercase;letter-spacing:0.14em;margin-bottom:4px;font-family:'JetBrains Mono',monospace">bohopo</div>
            <div style="font-size:0.85rem;font-weight:500;color:#a1a1aa;font-family:'Inter',sans-serif">Acquisition Intelligence</div>
        </div>
    """, unsafe_allow_html=True)

    st.markdown("---")

    all_cities = sorted(df_all["city"].unique())
    selected_cities = st.multiselect(
        "Cities",
        options=all_cities,
        default=all_cities,
        placeholder="All cities",
    )

    max_rating = st.slider(
        "Max rating (show only ≤)",
        min_value=1.0,
        max_value=5.0,
        value=5.0,
        step=0.1,
        format="⭐ %.1f",
    )

    min_reviews = st.number_input(
        "Min reviews",
        min_value=0,
        max_value=2000,
        value=50,
        step=25,
    )

    room_range = st.slider(
        "Room count",
        min_value=10,
        max_value=80,
        value=(15, 60),
        step=5,
    )

    price_options = ["$", "$$", "$$$", "$$$$"]
    selected_prices = st.multiselect(
        "Price level",
        options=price_options,
        default=["$$", "$$$"],
    )
    price_level_map = {"$": 1, "$$": 2, "$$$": 3, "$$$$": 4}
    selected_price_levels = [price_level_map[p] for p in selected_prices] if selected_prices else [1, 2, 3, 4]

    st.markdown("---")
    st.markdown("""
        <div style="font-size:0.62rem;color:#3f3f46;line-height:1.8;font-family:'JetBrains Mono',monospace">
            <span style="color:#52525b">score bands</span><br>
            <span style="color:#fca5a5">■</span> 70+ &nbsp;priority target<br>
            <span style="color:#fcd34d">■</span> 40-69 watch list<br>
            <span style="color:#86efac">■</span> &lt;40 &nbsp;healthy
        </div>
    """, unsafe_allow_html=True)

    st.markdown("---")
    st.markdown("""
        <div style="font-size:0.56rem;color:#27272a;line-height:1.7;font-family:'JetBrains Mono',monospace">
            last sync: mar 19, 2026<br>
            sources: booking // google // tripadvisor
        </div>
    """, unsafe_allow_html=True)


# ──────────────────────────────────────────────
# Filter data
# ──────────────────────────────────────────────

df = df_all.copy()
if selected_cities:
    df = df[df["city"].isin(selected_cities)]
df = df[df["rating"] <= max_rating]
df = df[df["review_count"] >= min_reviews]
if selected_price_levels:
    df = df[df["price_level"].isin(selected_price_levels)]
df = df[df["room_count"].between(room_range[0], room_range[1])]

df = df.sort_values("acquisition_score", ascending=False).reset_index(drop=True)

# ──────────────────────────────────────────────
# Header
# ──────────────────────────────────────────────

st.markdown("""
    <div class="bohopo-header">
        <div>
            <div class="bohopo-logo">bohopo</div>
            <div class="bohopo-tagline">acquisition intelligence // eu city centers</div>
            <div class="bohopo-refreshed">● live &mdash; last sync 4m ago</div>
        </div>
        <div class="bohopo-badge">internal // confidential</div>
    </div>
""", unsafe_allow_html=True)

# ──────────────────────────────────────────────
# Stats bar
# ──────────────────────────────────────────────

priority_count = len(df[df["acquisition_score"] >= 70])
avg_score = int(df["acquisition_score"].mean()) if len(df) > 0 else 0
avg_rate = int(df["avg_nightly_rate"].mean()) if len(df) > 0 else 0
top_hotel = df.iloc[0] if len(df) > 0 else None
top_hotel_text = f"{top_hotel['name']} ({top_hotel['acquisition_score']})" if top_hotel is not None else "—"

col1, col2, col3, col4 = st.columns(4)

with col1:
    st.metric("Properties Monitored", len(df))
with col2:
    st.metric("Priority Targets", priority_count, delta=f"score ≥ 70")
with col3:
    st.metric("Avg Acquisition Score", avg_score)
with col4:
    st.metric("Avg Nightly Rate", f"€{avg_rate}")


# ──────────────────────────────────────────────
# Hotel table
# ──────────────────────────────────────────────

st.markdown('<div class="section-title">targets</div>', unsafe_allow_html=True)

if len(df) == 0:
    st.markdown("""
        <div style="text-align:center;padding:40px;color:#27272a;border:1px dashed #1a1a1f;border-radius:6px;font-family:'JetBrains Mono',monospace;font-size:0.78rem">
            no matches // adjust filters
        </div>
    """, unsafe_allow_html=True)
else:
    # Build table HTML
    rows_html = ""
    for _, row in df.iterrows():
        flag = CITY_FLAGS.get(row["city"], "")
        city_display = f'{flag} {row["city"]}'
        rating_str = sub_ratings_tooltip(row)
        reviews_str = f"{row['review_count']:,}"
        score_str = score_badge(int(row["acquisition_score"]))
        price_str = PRICE_LABELS.get(row["price_level"], "$$")
        trend_str = TREND_ICONS.get(row.get("rating_trend", "flat"), "—")
        change_30d = row.get("rating_30d_change", 0)
        change_str = rating_change_html(change_30d)
        rooms_str = str(int(row["room_count"]))
        rate_str = f"€{int(row['avg_nightly_rate'])}"

        rows_html += f"""
        <tr>
            <td><a class="hotel-name-link" href="{row['maps_url']}" target="_blank">{row['name']}</a></td>
            <td class="city-cell">{city_display}</td>
            <td style="text-align:center;font-family:'JetBrains Mono',monospace;font-size:0.78rem;color:#52525b">{rooms_str}</td>
            <td>{rating_str} {trend_str}</td>
            <td style="text-align:center">{change_str}</td>
            <td class="review-count" style="text-align:right">{reviews_str}</td>
            <td style="color:#3f3f46;font-family:'JetBrains Mono',monospace;font-size:0.78rem">{rate_str}</td>
            <td style="color:#3f3f46">{price_str}</td>
            <td>{score_str}</td>
        </tr>
        """

    table_html = f"""
    <div style="background:#0c0c0e;border:1px solid #1a1a1f;border-radius:6px;overflow:hidden;max-height:440px;overflow-y:auto">
        <table class="hotel-table">
            <thead>
                <tr>
                    <th>Property</th>
                    <th>City</th>
                    <th style="text-align:center">Rooms</th>
                    <th>Rating</th>
                    <th style="text-align:center">30d &Delta;</th>
                    <th style="text-align:right">Reviews</th>
                    <th>Avg Rate</th>
                    <th>Price</th>
                    <th>Score</th>
                </tr>
            </thead>
            <tbody>
                {rows_html}
            </tbody>
        </table>
    </div>
    """
    st.html(table_html)
    st.html(
        f'<div style="font-size:0.62rem;color:#27272a;margin-top:6px;font-family:\'JetBrains Mono\',monospace;letter-spacing:0.03em">'
        f'{len(df)} properties // sorted by acquisition score // hover rating for breakdown // click property for map</div>'
    )


# ──────────────────────────────────────────────
# AI Chat
# ──────────────────────────────────────────────

st.markdown('<div class="section-title">analyst</div>', unsafe_allow_html=True)

if not OPENAI_API_KEY:
    st.warning("Set `OPENAI_API_KEY` in `.env` to enable AI chat.")
else:
    # Show last response if any
    if "last_response" in st.session_state and "last_prompt" in st.session_state:
        with st.container():
            st.html(f"""
                <div style="margin-bottom:12px">
                    <span style="font-size:0.6rem;color:#3f3f46;text-transform:uppercase;letter-spacing:0.08em;font-family:'JetBrains Mono',monospace">query</span><br>
                    <span style="color:#52525b;font-style:italic;font-size:0.85rem">"{st.session_state.last_prompt}"</span>
                </div>
            """)
            response_html = md_lib.markdown(st.session_state.last_response)
            st.html(
                f'<div class="chat-container"><div class="chat-response">{response_html}</div></div>'
            )
    else:
        st.html("""
            <div class="chat-container" style="display:flex;align-items:center;justify-content:center;color:#27272a;font-size:0.78rem;font-style:italic;font-family:'JetBrains Mono',monospace">
                query targets, markets, or operator risk signals...
            </div>
        """)

    st.markdown("<div style='height:8px'></div>", unsafe_allow_html=True)

    suggested = [
        "What are the top 3 hotels I should approach in Athens?",
        f"Find me priority targets in {selected_cities[0] if selected_cities else 'Brussels'}",
        "Which city has the strongest acquisition pipeline right now?",
        "Compare the operator quality in Athens vs Brussels",
    ]

    col_s1, col_s2 = st.columns(2)
    for i, suggestion in enumerate(suggested):
        col = col_s1 if i % 2 == 0 else col_s2
        with col:
            if st.button(suggestion, key=f"sug_{i}", use_container_width=True):
                st.session_state.pending_prompt = suggestion

    prompt = st.chat_input("Ask about acquisition targets, market conditions, or specific cities...")

    # Handle button suggestions
    if "pending_prompt" in st.session_state:
        prompt = st.session_state.pop("pending_prompt")

    if prompt:
        # Get context hotels -- top 30 scored from current filter
        context_cols = ["name", "city", "rating", "review_count", "price_level", "room_count",
                        "avg_nightly_rate", "cleanliness_rating", "service_rating", "value_rating",
                        "rating_trend", "acquisition_score"]
        context_df = df.head(30)[context_cols]
        context_json = context_df.to_json(orient="records", indent=2)

        full_prompt = f"""Current filtered hotel data (top 30 by acquisition score):

{context_json}

Active filters: Cities = {selected_cities or 'All'}, Max rating = {max_rating}, Min reviews = {min_reviews}, Room count = {room_range[0]}-{room_range[1]}

Question: {prompt}"""

        with st.spinner("Analyzing acquisition targets..."):
            client = OpenAI(api_key=OPENAI_API_KEY)
            response = client.chat.completions.create(
                model="gpt-4o",
                max_tokens=1024,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": full_prompt},
                ],
            )
            answer = response.choices[0].message.content

        st.session_state.last_prompt = prompt
        st.session_state.last_response = answer
        st.rerun()


# ──────────────────────────────────────────────
# Footer
# ──────────────────────────────────────────────

st.markdown("""
    <div style="margin-top:40px;padding-top:12px;border-top:1px solid #18181b;font-size:0.56rem;color:#27272a;text-align:center;font-family:'JetBrains Mono',monospace;letter-spacing:0.06em">
        bohopo acquisition intelligence // powered by dealwire
    </div>
""", unsafe_allow_html=True)
