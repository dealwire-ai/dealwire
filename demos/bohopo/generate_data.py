#!/usr/bin/env python3
"""
Generate synthetic hotel data for the Bohopo acquisition intelligence demo.
Run once: python generate_data.py
Outputs JSON files to data/ directory.
"""

import json
import math
import random
import uuid
from pathlib import Path

random.seed(42)

CITIES = {
    "Athens": {
        "country": "GR",
        "flag": "🇬🇷",
        "center": (37.9755, 23.7348),
        "streets": [
            "Adrianou", "Ermou", "Monastiraki", "Mitropoleos", "Athinas",
            "Stadiou", "Panepistimiou", "Syntagma", "Kolonaki", "Plaka",
            "Voulis", "Nikis", "Filellinon", "Apollonos", "Kidathineon",
        ],
        "neighborhoods": ["Plaka", "Monastiraki", "Syntagma", "Kolonaki", "Exarcheia", "Psiri"],
        "zip_prefix": "105",
        "hotel_names": [
            "Hotel Acropolis", "Athens Classic Hotel", "Plaka Inn",
            "Hotel Parthenon", "Monastiraki Boutique", "Athens City Hotel",
            "Hotel Dionysos", "Athen's Grand", "Hotel Olympia",
            "Kolonaki Suites", "Hotel Hermes", "Athens Panorama",
            "Hotel Delphi", "Syntagma Place", "Hotel Electra",
            "Poseidon Hotel", "Hotel Aphrodite", "Athens Central",
            "Hotel Apollo", "Lycabettus View", "Hotel Agamemnon",
            "Piraeus Gate Hotel", "Hotel Thesseion", "Acropolis Hill Hotel",
            "Hotel Iris", "Athens Boutique", "Hotel Zeus", "Atrium Athens",
            "Hotel Nike", "Monastiraki Square Hotel", "Ermou Hotel",
            "Hotel Pallas", "Athens Dreams", "Hotel Victoria",
            "Nefeli Hotel", "Hotel Nestor", "Zea Hotel", "Hotel Ambrosia",
            "Psiri District Hotel", "Omonia Hotel",
        ],
    },
    "Thessaloniki": {
        "country": "GR",
        "flag": "🇬🇷",
        "center": (40.6401, 22.9444),
        "streets": [
            "Tsimiski", "Egnatia", "Aristotelous", "Mitropoleos", "Proxenou Koromila",
            "Nikis", "Venizelou", "Agias Sofias", "Ermou", "Dragoumi",
            "Komninon", "Olympou", "Ionos Dragoumi", "Pavlou Mela",
        ],
        "neighborhoods": ["Ladadika", "Ano Poli", "Aristotelous", "Toumba", "Kalamaria"],
        "zip_prefix": "546",
        "hotel_names": [
            "Hotel Macedonia", "Thessaloniki Palace", "White Tower Hotel",
            "Hotel Aristotle", "Ladadika Boutique", "Hotel Makedonia",
            "Rotonda Hotel", "Hotel Olympos", "Byzantine Hotel",
            "Thessaloniki Grand", "Hotel Vergina", "Porto Palace",
            "Hotel Capsis", "Egnatia Hotel", "Hotel Electra Palace",
            "Hotel Excelsior", "Hotel Continental", "Nea Egnatia Hotel",
            "Hotel Niki", "Thessaloniki City", "Hotel Pella",
            "Hotel Mandrino", "ABC Hotel", "Hotel Tourist",
            "Hotel Amalia", "Thessaloniki Inn", "Hotel Panorama",
            "Hotel Philippos", "Rex Hotel", "Hotel Anatolia",
            "Hotel Domotel", "Hotel Augustos", "Thessaly Hotel",
            "Hotel Aristotelous", "Hotel Anthemion", "Hotel Ariston",
            "Agios Dimitrios Hotel", "Vardaris Hotel", "Thermaikos Hotel",
            "Hotel Kastoria",
        ],
    },
    "Marseille": {
        "country": "FR",
        "flag": "🇫🇷",
        "center": (43.2965, 5.3698),
        "streets": [
            "Rue de la République", "Canebière", "Rue Paradis", "Cours Belsunce",
            "Boulevard Garibaldi", "Rue Saint-Ferréol", "Avenue du Prado",
            "Rue Sainte", "Rue d'Aubagne", "Boulevard Longchamp",
            "Rue Noailles", "Quai du Port", "Place Castellane",
            "Rue de Rome", "Boulevard Charles Livon",
        ],
        "neighborhoods": ["Vieux-Port", "Le Panier", "Noailles", "Belle de Mai", "Castellane"],
        "zip_prefix": "130",
        "hotel_names": [
            "Le Vieux Port Hotel", "Hotel de la Préfecture", "Hôtel Hermès",
            "Le Petit Nice", "Hotel Kyriad", "Hôtel Saint-Louis",
            "Best Western Marseille", "Hôtel La Résidence", "Hôtel Escale Oceania",
            "Hotel Sofitel Marseille", "Hôtel Vertigo", "Hôtel Lacydon",
            "Hotel Novotel", "Hôtel du Palais", "Hotel Mercure",
            "Hôtel Monteux", "Le Miramar Hotel", "Hôtel Edmond Rostand",
            "Hotel Ibis Vieux Port", "Hôtel Le Corbusier", "Hôtel Windsor",
            "Grand Hotel Beauvau", "Hôtel Alize", "Hotel New Astoria",
            "Hôtel Saint Charles", "Hotel Relax", "Hôtel Massalia",
            "Le Comptoir Hotel", "Hôtel Libertel", "Hotel Carré Vieux Port",
            "Hôtel Bellevue", "Hôtel Continental", "Hôtel Estanque",
            "Hotel Joliette", "Hôtel des Augustins", "Hôtel La Plaine",
            "Hotel Lutetia", "Hôtel du Chapitre", "Hôtel National",
            "Hôtel Passédat",
        ],
    },
    "Brussels": {
        "country": "BE",
        "flag": "🇧🇪",
        "center": (50.8503, 4.3517),
        "streets": [
            "Rue Neuve", "Boulevard Anspach", "Rue du Marché aux Herbes",
            "Avenue Louise", "Rue de la Loi", "Grand Place",
            "Rue des Bouchers", "Boulevard du Midi", "Rue Royale",
            "Place Sainte-Catherine", "Rue du Fossé aux Loups", "Rue Montagne aux Herbes Potagères",
            "Boulevard Émile Jacqmain", "Rue des Chapeliers",
        ],
        "neighborhoods": ["Grand Place", "Sablon", "Ixelles", "Etterbeek", "Molenbeek"],
        "zip_prefix": "10",
        "hotel_names": [
            "Hotel Metropole Brussels", "Le Dixseptième", "Hotel Amigo",
            "Brussels Grand Hotel", "Hotel Astoria", "Hôtel Siru",
            "Hotel Bedford Brussels", "Les Bluets", "Hotel NH Brussels",
            "Hotel Bloom", "Hotel Atlas", "Hôtel Mozart",
            "Hotel Vendôme Brussels", "Crowne Plaza Brussels", "Hotel Ibis Grand Place",
            "Hotel de Fierlant", "Hotel Argus Brussels", "Hotel Citadines",
            "Hotel Floris", "Hotel Welcome", "Hôtel de Boeck",
            "Brussels Marriott", "Hotel 9", "Hotel Noga",
            "Agenda Hotel Louise", "Hotel du Congrès", "Hotel Madou",
            "Hôtel Le Châtelain", "Hotel K+K", "Brussels Europe",
            "Hotel Saint Nicolas", "Hôtel Européen", "Hotel Diplomate",
            "Hotel Carrefour de l'Europe", "Brussels Center Hotel",
            "Hotel Made in Louise", "Hotel Hubert", "Hôtel Pacific",
            "Radisson Brussels", "Hotel Agenda",
        ],
    },
    "Porto": {
        "country": "PT",
        "flag": "🇵🇹",
        "center": (41.1579, -8.6291),
        "streets": [
            "Rua das Flores", "Rua de Santa Catarina", "Rua do Almada",
            "Avenida dos Aliados", "Rua dos Clérigos", "Rua do Infante D. Henrique",
            "Rua de Cedofeita", "Rua Mouzinho da Silveira", "Rua da Vitória",
            "Rua do Bonjardim", "Rua 31 de Janeiro", "Rua do Carmo",
            "Rua das Taipas", "Rua de Fernandes Tomás",
        ],
        "neighborhoods": ["Ribeira", "Bonfim", "Cedofeita", "Massarelos", "Foz do Douro"],
        "zip_prefix": "40",
        "hotel_names": [
            "Hotel Infante Sagres", "The Yeatman", "InterContinental Porto",
            "Hotel das Artes", "Porto AS 1829", "Hotel Pestana Porto",
            "Hotel Aliados", "Hotel da Bolsa", "Grande Hotel do Porto",
            "Hotel Malaposta", "Hotel Casa da Calçada", "Hotel Inatel Porto",
            "Hôtel Universal Porto", "Hotel Quality Inn Porto", "Hotel América",
            "Hotel Boa Vista", "Porto Palacio", "Hotel Exe Almada Porto",
            "Hotel Eurostars", "Hotel Corinthia Porto", "Hotel Mercure Porto",
            "Dom Henrique Hotel", "Hotel Carris", "Sheraton Porto",
            "Hotel Arca d'Água", "Hotel Real Palácio Porto", "Hotel Monumental",
            "Douro Palace Hotel", "Hotel Bessa", "Hotel Vitória",
            "Hotel Modern Porto", "Hotel Casa do Conto", "Hotel Flow",
            "Hotel Ateneu", "Ribeira House", "Hotel Nacional Porto",
            "Hotel Ipanema Park", "Hotel Leixões", "Porto City Hotel",
            "Hotel Grande Batalha",
        ],
    },
}


def acquisition_score(rating: float, reviews: int) -> int:
    """
    Higher score = stronger acquisition signal (low rating, high review volume).
    Score range: 0–100
    """
    rating_signal = (5.0 - rating) / 4.0
    confidence = min(math.log10(reviews + 1) / math.log10(500), 1.0)
    return round(rating_signal * confidence * 100)


def generate_city_hotels(city_name: str, city_data: dict, count: int = 40) -> list:
    hotels = []
    names = city_data["hotel_names"].copy()
    random.shuffle(names)

    lat_center, lng_center = city_data["center"]

    for i in range(count):
        # Bimodal rating distribution:
        # ~30% bad hotels (2.0–3.4) — acquisition targets
        # ~70% healthy hotels (3.8–4.7)
        if random.random() < 0.30:
            rating = round(random.uniform(2.0, 3.4), 1)
            # Bad hotels tend to have more reviews (signal they're established, not new)
            review_count = int(random.triangular(150, 1800, 600))
        else:
            rating = round(random.uniform(3.8, 4.7), 1)
            review_count = int(random.triangular(30, 1500, 200))

        # Street address
        street = random.choice(city_data["streets"])
        street_num = random.randint(1, 120)
        zip_suffix = str(random.randint(10, 99))
        address = f"{street} {street_num}, {city_name} {city_data['zip_prefix']}{zip_suffix}"

        # GPS with small offset from city center
        lat = lat_center + random.uniform(-0.03, 0.03)
        lng = lng_center + random.uniform(-0.035, 0.035)

        # Price level: boutique targets tend to be 2-3
        price_level = random.choices([1, 2, 3, 4], weights=[5, 45, 40, 10])[0]

        name = names[i % len(names)]
        score = acquisition_score(rating, review_count)

        hotels.append({
            "id": str(uuid.uuid4()),
            "name": name,
            "city": city_name,
            "country": city_data["country"],
            "flag": city_data["flag"],
            "address": address,
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "rating": rating,
            "review_count": review_count,
            "price_level": price_level,
            "acquisition_score": score,
            "maps_url": f"https://maps.google.com/?q={round(lat,6)},{round(lng,6)}",
        })

    return hotels


def main():
    data_dir = Path(__file__).parent / "data"
    data_dir.mkdir(exist_ok=True)

    total = 0
    for city_name, city_data in CITIES.items():
        hotels = generate_city_hotels(city_name, city_data, count=40)
        out_file = data_dir / f"{city_name.lower()}.json"
        with open(out_file, "w") as f:
            json.dump(hotels, f, indent=2)
        flagged = sum(1 for h in hotels if h["acquisition_score"] >= 70)
        print(f"{city_data['flag']} {city_name}: {len(hotels)} hotels, {flagged} priority targets → {out_file}")
        total += len(hotels)

    print(f"\nTotal: {total} hotels across {len(CITIES)} cities")


if __name__ == "__main__":
    main()
