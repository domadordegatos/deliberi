import { Component } from '@angular/core';
import * as L from 'leaflet';
import { v4 as uuidv4 } from 'uuid';
import { getFirestore, collection, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { LocationData } from '../interfaces/location-data'; // Importa la interfaz

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {
  db = getFirestore(); // Inicializar Firestore
  map!: L.Map;
  uniqueId = this.generateUniqueId(); // Generar ID único
  markers: { [id: string]: L.Marker } = {}; // Almacenar marcadores existentes
  initialLatitude!: number;
  initialLongitude!: number;

  constructor() {}

  centerMap() {
    this.map.setView([this.initialLatitude, this.initialLongitude], 16);
  }

  zoomIn() {
    this.map.zoomIn();  
  }

  zoomOut() {
    this.map.zoomOut();  
  }

    async getUserLocation() {
    return new Promise<any>((resolve, reject) => {  
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => resolve(position),
          (error) => reject(error)
        );
      } else {
        reject('Geolocalización no soportada');
      }
    });
  }

  ionViewWillEnter() {
    this.getUserLocation().then((position) => {
      const { latitude, longitude } = position.coords;
      this.initialLatitude = latitude; // Guardamos las coordenadas del usuario
      this.initialLongitude = longitude;
      this.saveLocationToFirestore(latitude, longitude); // Asegúrate de guardar la ubicación
      this.initializeMap(latitude, longitude); // Luego inicializa el mapa
    }).catch(error => {
      console.error('Error obteniendo ubicación', error);
      this.initializeMap(5.333827, -72.381054);  // Coordenadas por defecto
    });
    
  }
  initializeMap(latitude: number, longitude: number) {
    this.map = L.map('mapId', {
      center: [latitude, longitude],
      zoom: 16,
      zoomControl: false
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.map);

    const userIcon = L.icon({
      iconUrl: 'assets/images/moto.png',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    });

    this.listenToLocationsInRealtime(userIcon);

    // Obtener la ubicación del usuario
    navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        // Guardar o actualizar la ubicación en Firestore
        this.saveLocationToFirestore(lat, lng);
      },
      (err) => {
        console.error('Error al obtener la ubicación', err);
      }
    );
  }
/*   ionViewDidEnter(latitude: number, longitude: number) {
    const customIcon2 = L.icon({
      iconUrl: 'assets/images/moto.png', // Cambia por el ícono que desees
      iconSize: [35, 41],
      iconAnchor: [12, 41],
      popupAnchor: [0, -41],
    });

    this.map = L.map('mapId', {
      center: [latitude, longitude],
      zoom: 16,
      zoomControl: false
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.map);

    // Escuchar en tiempo real los cambios en Firestore
    this.listenToLocationsInRealtime(customIcon2);

    // Obtener la ubicación del usuario
    navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        // Guardar o actualizar la ubicación en Firestore
        this.saveLocationToFirestore(lat, lng);
      },
      (err) => {
        console.error('Error al obtener la ubicación', err);
      }
    );
  } */

  generateUniqueId() {
    return uuidv4(); // Generar un id único usando uuid
  }

  async saveLocationToFirestore(lat: number, lon: number) {
    try {
      const userRef = doc(this.db, 'locations', this.uniqueId); // Obtener referencia al documento
      const locationData: LocationData = {
        lat: lat,
        lon: lon,
        timestamp: new Date(),
      };
      await setDoc(userRef, locationData, { merge: true }); // merge: true asegura que solo se actualicen los campos
      console.log('Ubicación actualizada exitosamente en Firestore');
    } catch (error) {
      console.error('Error al actualizar la ubicación en Firestore', error);
    }
  }

  listenToLocationsInRealtime(icon: L.Icon) {
    const locationsRef = collection(this.db, 'locations');

    onSnapshot(locationsRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const docId = change.doc.id;
        const data = change.doc.data() as LocationData;

        if (change.type === 'added' || change.type === 'modified') {
          if (this.markers[docId]) {
            // Si ya existe el marcador, actualízalo
            this.markers[docId].setLatLng([data.lat, data.lon]);
          } else {
            // Si es un marcador nuevo, agrégalo al mapa
            const marker = L.marker([data.lat, data.lon], { icon }).addTo(this.map);
            marker.bindPopup(`<p>ID: ${docId}</p><p>Lat: ${data.lat}</p><p>Lon: ${data.lon}</p>`);
            this.markers[docId] = marker; // Almacenar el marcador
          }
        } else if (change.type === 'removed') {
          // Si se eliminó, remueve el marcador del mapa
          if (this.markers[docId]) {
            this.map.removeLayer(this.markers[docId]);
            delete this.markers[docId];
          }
        }
      });
    });
  }
}
