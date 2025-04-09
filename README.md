<<<<<<< HEAD
# PiHappy Applicatie

Dit project is een webapplicatie gebouwd met een Flask (Python) backend en een React (JavaScript) frontend. Het maakt gebruik van MongoDB als database.

## Functionaliteit

De applicatie biedt de volgende kernfunctionaliteiten:

*   **Gebruikersauthenticatie:** Gebruikers kunnen zich registreren en inloggen via API-endpoints.
*   **Winkelbeheer:** Geregistreerde gebruikers kunnen winkels toevoegen met details zoals naam, categorie, locatie en type via een daarvoor bestemd formulier in de frontend en een API-endpoint in de backend.
*   **Modulaire Structuur:** De backend is georganiseerd met Flask Blueprints voor verschillende functionaliteiten, waaronder:
    *   `auth`: Authenticatie
    *   `shop`: Toevoegen van winkels
    *   `winkels`: Waarschijnlijk weergave/beheer van winkels
    *   `chat`: Chatfunctionaliteit
    *   `community`: Community-gerelateerde features
    *   `journal`: Dagboek/logboek functionaliteit
    *   `utils`: Hulpfuncties (geolocatie, taalondersteuning, AI, bestandsbeheer)
*   **Frontend:** Een single-page application (SPA) gebouwd met React, die communiceert met de Flask backend API's.

## Workflow (Basis)

1.  De gebruiker opent de React frontend in de browser.
2.  De gebruiker navigeert naar de registratie- of loginpagina.
3.  De frontend stuurt gebruikersgegevens naar de `/api/register` of `/api/login` endpoints van de Flask backend.
4.  De backend valideert de gegevens, interacteert met de MongoDB `users` collectie en beheert de gebruikerssessie.
5.  Na het inloggen kan de gebruiker navigeren naar functionaliteiten zoals het toevoegen van een winkel (`/AddShopForm`).
6.  Het winkelformulier in de frontend stuurt de data naar het `/api/shops` endpoint.
7.  De backend slaat de nieuwe winkel op in de MongoDB `shops` collectie.

## Projectstructuur (Vereenvoudigd)

```
c:/pihappy1/
├── .env
├── app.py                 # Hoofd Flask applicatie setup
├── config.py              # Flask configuratie
├── blueprints/            # Backend modules (auth, chat, community, journal, shop, utils, winkels)
│   ├── auth/
│   ├── chat/
│   ├── community/
│   ├── journal/
│   ├── shop/
│   ├── utils/
│   └── winkels/
├── frontend/              # Frontend React applicatie
│   ├── package.json
│   ├── public/
│   └── src/
│       ├── App.js         # Hoofd React component met routing
│       ├── index.js
│       └── components/    # React componenten (Home, Register, Login, AddShopForm)
├── static/                # Statische bestanden voor Flask
├── templates/             # HTML templates voor Flask
└── ...
```

## Setup en Draaien

*(Instructies voor het opzetten en draaien van de applicatie moeten hier nog worden toegevoegd)*
=======
# pigood
>>>>>>> 135d5cd7a511fffd1ed69b90c4e57d9e1bfbb562
