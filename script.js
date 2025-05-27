// Luodaan tyhjä objekti aseman lyhenteiden ja nimien tallentamiseen
let stationMap = {};

// Haetaan kaikki asemat Digitrafficin rajapinnasta ja täytetään valintalistat
$.getJSON("https://rata.digitraffic.fi/api/v1/metadata/stations", function(data) {
  data.forEach(station => {
    // Otetaan mukaan vain matkustajaliikenteen asemat
    if (station.passengerTraffic) {
      // Tallennetaan aseman lyhenne ja nimi map-muotoon
      stationMap[station.stationShortCode] = station.stationName;

      // Luodaan uusi <option> ja lisätään se molempiin valintalistoihin
      const option = `<option value="${station.stationShortCode}">${station.stationName}</option>`;
      $("#fromStation").append(option);
      $("#toStation").append(option);
    }
  });

  // Haetaan localStoragesta viimeksi tallennettu reitti (jos löytyy)
  const saved = JSON.parse(localStorage.getItem("lastRoute"));
  if (saved && saved.from && saved.to) {
    // Asetetaan valitut asemat kenttiin ja haetaan automaattisesti junat
    setTimeout(() => {
      $("#fromStation").val(saved.from);
      $("#toStation").val(saved.to);
      fetchTrains(saved.from, saved.to); // Haetaan junat tallennetulle reitille
    }, 500); // Lyhyt viive, jotta dropdownit ehtivät täyttyä ensin
  }
});

// Funktio, joka hakee ja näyttää aikataulut kahden aseman välillä
function fetchTrains(from, to) {
  // Näytetään latausteksti käyttäjälle
  $("#results").html("<p>Haetaan aikatauluja...</p>");

  // Haetaan junat lähtöasemalta (vain tulevat junat)
  $.getJSON(`https://rata.digitraffic.fi/api/v1/live-trains/station/${from}?arrived_trains=0&departed_trains=0&include_nonstopping=false`, function(data) {
    // Tyhjennetään tulosalue
    $("#results").empty();
    const now = new Date(); // Haetaan nykyinen aika

    // Suodatetaan vain junat, jotka menevät molempien asemien kautta ja lähtevät tulevaisuudessa
    const filtered = data.filter(train => {
      const fromStop = train.timeTableRows.find(r => r.stationShortCode === from && r.type === "DEPARTURE");
      const toStop = train.timeTableRows.find(r => r.stationShortCode === to && r.type === "ARRIVAL");
      return fromStop && toStop && new Date(fromStop.scheduledTime) > now;
    });

    // Jos ei löytynyt sopivia junia, näytetään viesti
    if (filtered.length === 0) {
      $("#results").html("<p>Ei tulevia junia löytynyt.</p>");
      return;
    }

    // Järjestetään junat lähtöajan mukaan
    filtered.sort((a, b) =>
      new Date(a.timeTableRows.find(r => r.stationShortCode === from && r.type === "DEPARTURE").scheduledTime)
      - new Date(b.timeTableRows.find(r => r.stationShortCode === from && r.type === "DEPARTURE").scheduledTime)
    );

    // Käydään läpi jokainen juna ja näytetään tiedot
    filtered.forEach(train => {
      // Haetaan lähtö- ja saapumisajat
      const fromTime = train.timeTableRows.find(r => r.stationShortCode === from && r.type === "DEPARTURE");
      const toTime = train.timeTableRows.find(r => r.stationShortCode === to && r.type === "ARRIVAL");

      const dep = new Date(fromTime.scheduledTime);
      const arr = new Date(toTime.scheduledTime);

      // Lasketaan mahdollinen viive minuutteina
      const delay = fromTime.liveEstimateTime ? Math.round((new Date(fromTime.liveEstimateTime) - dep) / 60000) : 0;

      // Lasketaan matkan kesto minuutteina
      const mins = Math.round((arr - dep) / 60000);

      // Haetaan raide (jos tiedossa)
      const platform = fromTime.commercialTrack || "?";

      // Muodostetaan HTML-esitys yhdelle junalle
      const html = `
        <div>
          <p><strong>${train.trainType} ${train.trainNumber}</strong> – ${stationMap[from]} → ${stationMap[to]}</p>
          <p>Lähtöaika: ${dep.toLocaleTimeString("fi-FI")} ${delay ? `(Viivästys: ${delay} min)` : ""}</p>
          <p>Saapumisaika: ${arr.toLocaleTimeString("fi-FI")}</p>
          <p>Kesto: ${mins} min</p>
          <p>Raide: ${platform}</p>
        </div>
      `;

      // Lisätään junan tiedot tulosalueelle fadeIn-tehosteella
      $("#results").append(html).hide().fadeIn(300);
    });

  }).fail(() => {
    // Jos pyyntö epäonnistuu, näytetään virheilmoitus
    $("#results").html("<p>Virhe haettaessa tietoja.</p>");
  });
}

// Kun käyttäjä painaa "Hae aikataulut" -painiketta
$("#searchBtn").on("click", function() {
  // Haetaan valitut asemat
  const from = $("#fromStation").val();
  const to = $("#toStation").val();

  // Tarkistetaan, että asemat on valittu oikein
  if (from && to && from !== to) {
    // Tallennetaan valinta localStorageen myöhempää käyttöä varten
    localStorage.setItem("lastRoute", JSON.stringify({ from, to }));

    // Haetaan junien tiedot
    fetchTrains(from, to);
  } else {
    // Näytetään virheilmoitus, jos valinnat eivät ole kunnossa
    $("#results").html("<p>Valitse eri lähtö- ja määränpääasema.</p>");
  }
});