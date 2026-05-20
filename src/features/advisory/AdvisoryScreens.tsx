import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Image,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  Keyboard,
  Animated,
  Pressable,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { COLORS, SPACING, BORDER_RADIUS } from '../../theme';
import {
  fetchCurrentWeather,
  fetchForecast,
  reverseGeocode,
  geocodeCity,
  searchSuggestions,
  WeatherData,
  LocationInfo,
  CitySuggestion,
} from '../../services/weatherService';
import {
  CloudRain,
  Wind,
  Droplets,
  Thermometer,
  Calendar,
  MapPin,
  ArrowLeft,
  LocateFixed,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  Search,
  Navigation,
  X,
} from 'lucide-react-native';

// ─── Constants ───────────────────────────────────────────────────────────────

type LoadPhase = 'locating' | 'fetching' | 'done' | 'error';

const CHENNAI_FALLBACK: LocationInfo = {
  city: 'Chennai',
  state: 'Tamil Nadu',
  country: 'IN',
  display: 'Chennai, Tamil Nadu',
};

const QUICK_CITIES = [
  'Chennai', 'Madurai', 'Coimbatore', 'Salem',
  'Tirunelveli', 'Trichy', 'Bangalore', 'Hyderabad',
];

const CARD_WIDTH = 136;
const CARD_GAP = 12;

// ─── Main Component ───────────────────────────────────────────────────────────

export const RainUpdates = ({ navigation }: any) => {
  const [phase, setPhase] = useState<LoadPhase>('locating');
  const [locationInfo, setLocationInfo] = useState<LocationInfo>(CHENNAI_FALLBACK);
  const [locationDenied, setLocationDenied] = useState(false);
  const [current, setCurrent] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<WeatherData[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Location modal
  const [modalVisible, setModalVisible] = useState(false);
  const [cityInput, setCityInput] = useState('');
  const [citySearching, setCitySearching] = useState(false);
  const [cityError, setCityError] = useState('');
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const modalAnim = useRef(new Animated.Value(0)).current;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load by coordinates ───────────────────────────────────────────────────
  const loadByCoords = useCallback(
    async (lat: number, lon: number, locInfo: LocationInfo, isRefresh = false) => {
      if (!isRefresh) setPhase('fetching');
      try {
        const [curr, fore] = await Promise.all([
          fetchCurrentWeather(lat, lon),
          fetchForecast(lat, lon),
        ]);
        setCurrent(curr);
        setForecast(fore);
        setLocationInfo(locInfo);
        setPhase('done');
      } catch (_) {
        setPhase('error');
      }
      if (isRefresh) setRefreshing(false);
    },
    [],
  );

  // ── Load from GPS ─────────────────────────────────────────────────────────
  const loadFromGPS = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) setPhase('locating');

      let lat = 13.0827;
      let lon = 80.2707;
      let locInfo = CHENNAI_FALLBACK;
      let denied = false;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          lat = pos.coords.latitude;
          lon = pos.coords.longitude;
          locInfo = await reverseGeocode(lat, lon);
        } else {
          denied = true;
        }
      } catch (_) {
        denied = true;
      }

      setLocationDenied(denied);
      await loadByCoords(lat, lon, locInfo, isRefresh);
    },
    [loadByCoords],
  );

  // ── Debounced autocomplete suggestions ────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (cityInput.trim().length < 2) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }
    setSuggestionsLoading(true);
    debounceRef.current = setTimeout(async () => {
      const results = await searchSuggestions(cityInput);
      setSuggestions(results);
      setSuggestionsLoading(false);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [cityInput]);

  // ── Load weather for a known suggestion (lat/lon already available) ────────
  const handleSuggestionTap = useCallback(
    (sug: CitySuggestion) => {
      closeModal();
      setCityInput('');
      setSuggestions([]);
      setLocationDenied(false);
      loadByCoords(sug.lat, sug.lon, {
        city: sug.city,
        state: sug.state,
        country: 'IN',
        display: sug.display,
      });
    },
    [loadByCoords],
  );

  // ── Load by city name (typed or quick chip) ───────────────────────────────
  const handleCitySearch = useCallback(
    async (city: string) => {
      if (!city.trim()) return;
      Keyboard.dismiss();
      setCitySearching(true);
      setCityError('');
      setSuggestions([]);
      try {
        const result = await geocodeCity(city);
        if (result) {
          closeModal();
          setCityInput('');
          setLocationDenied(false);
          await loadByCoords(result.lat, result.lon, result.location);
        } else {
          setCityError(`"${city}" not found. Check the spelling or try a nearby city.`);
        }
      } catch (_) {
        setCityError('Search failed. Please check your connection.');
      } finally {
        setCitySearching(false);
      }
    },
    [loadByCoords],
  );

  useEffect(() => {
    loadFromGPS();
  }, [loadFromGPS]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadFromGPS(true);
  }, [loadFromGPS]);

  // ── Modal helpers ─────────────────────────────────────────────────────────
  const openModal = () => {
    setCityInput('');
    setCityError('');
    setModalVisible(true);
    Animated.spring(modalAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  };

  const closeModal = () => {
    Keyboard.dismiss();
    setSuggestions([]);
    setCityError('');
    Animated.timing(modalAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setModalVisible(false));
  };

  const handleUseGPS = async () => {
    closeModal();
    await loadFromGPS();
  };

  const modalTranslateY = modalAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [400, 0],
  });

  // ─── Shared header ────────────────────────────────────────────────────────
  const Header = () =>
    navigation?.canGoBack?.() ? (
      <View style={styles.screenHeader}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ArrowLeft size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Weather Forecast</Text>
      </View>
    ) : null;

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (phase === 'locating' || phase === 'fetching') {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <Header />
        <View style={styles.centeredContainer}>
          <View style={styles.loadingCard}>
            <View style={styles.loadingIconRing}>
              {phase === 'locating' ? (
                <LocateFixed size={32} color={COLORS.primary} />
              ) : (
                <CloudRain size={32} color={COLORS.primary} />
              )}
            </View>
            <ActivityIndicator size="large" color={COLORS.primary} style={{ marginVertical: 16 }} />
            <Text style={styles.loadingTitle}>
              {phase === 'locating' ? 'Getting your location…' : 'Fetching live weather…'}
            </Text>
            <Text style={styles.loadingSubtitle}>
              {phase === 'locating'
                ? 'Finding your farm location'
                : 'Loading forecast for your area'}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Error ────────────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <Header />
        <View style={styles.centeredContainer}>
          <View style={styles.loadingCard}>
            <View style={[styles.loadingIconRing, { backgroundColor: '#FFF3E0' }]}>
              <AlertTriangle size={32} color="#FF8F00" />
            </View>
            <Text style={[styles.loadingTitle, { marginTop: 16 }]}>Weather Unavailable</Text>
            <Text style={styles.loadingSubtitle}>
              Could not load weather data.{'\n'}Check your internet connection.
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => loadFromGPS()}>
              <RefreshCw size={16} color="#FFF" />
              <Text style={styles.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Main UI ──────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Header />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* ─── WEATHER CARD ─────────────────────────────────────────────── */}
        {current && (
          <View style={styles.weatherCard}>

            {/* Decorative circles for visual depth */}
            <View style={styles.decCircle1} />
            <View style={styles.decCircle2} />

            {/* Location denied pill */}
            {locationDenied && (
              <View style={styles.deniedPill}>
                <AlertTriangle size={11} color="rgba(255,255,255,0.9)" />
                <Text style={styles.deniedPillText}>
                  Location denied — showing Chennai
                </Text>
              </View>
            )}

            {/* ── TOP ROW: location + condition badge ── */}
            <View style={styles.cardTopRow}>
              {/* Tappable location */}
              <TouchableOpacity
                style={styles.locationBtn}
                onPress={openModal}
                activeOpacity={0.75}
              >
                <MapPin size={16} color="rgba(255,255,255,0.9)" />
                <Text style={styles.locationText} numberOfLines={1}>
                  {locationInfo.display}
                </Text>
                <ChevronDown size={14} color="rgba(255,255,255,0.75)" style={{ marginLeft: 2 }} />
              </TouchableOpacity>

              {/* Condition badge */}
              <View style={styles.condBadge}>
                <Text style={styles.condBadgeText}>{current.condition}</Text>
              </View>
            </View>

            {/* Date */}
            <Text style={styles.dateText}>
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </Text>

            {/* ── MIDDLE: temp + icon ── */}
            <View style={styles.tempIconRow}>
              <View>
                <View style={styles.tempValueRow}>
                  <Text style={styles.tempNumber}>{current.temp}</Text>
                  <Text style={styles.tempUnit}>°C</Text>
                </View>
                <Text style={styles.descriptionText}>
                  {current.description
                    .split(' ')
                    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(' ')}
                </Text>
              </View>
              <Image
                source={{ uri: `https://openweathermap.org/img/wn/${current.icon}@4x.png` }}
                style={styles.weatherIcon}
              />
            </View>

            {/* ── BOTTOM: stats ── */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <View style={styles.statIconBox}>
                  <Thermometer size={16} color={COLORS.primary} />
                </View>
                <Text style={styles.statVal}>{current.humidity}%</Text>
                <Text style={styles.statLbl}>Humidity</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statItem}>
                <View style={styles.statIconBox}>
                  <Wind size={16} color={COLORS.primary} />
                </View>
                <Text style={styles.statVal}>{current.windSpeed}</Text>
                <Text style={styles.statLbl}>km/h Wind</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statItem}>
                <View style={styles.statIconBox}>
                  <CloudRain size={16} color={COLORS.primary} />
                </View>
                <Text style={styles.statVal}>{forecast[0]?.rainProbability ?? 0}%</Text>
                <Text style={styles.statLbl}>Rain</Text>
              </View>
            </View>
          </View>
        )}

        {/* ─── FORECAST HEADER ─────────────────────────────────────────── */}
        <View style={styles.forecastHeader}>
          <View style={styles.forecastHeaderLeft}>
            <Calendar size={18} color={COLORS.primary} />
            <Text style={styles.forecastTitle}>10-DAY FORECAST</Text>
          </View>
          <Text style={styles.forecastSubtitle}>{locationInfo.city}</Text>
        </View>

        {/* ─── FORECAST LIST ───────────────────────────────────────────── */}
        <FlatList
          data={forecast}
          keyExtractor={(_, i) => `fc-${i}`}
          renderItem={({ item, index }) => (
            <ForecastCard item={item} index={index} />
          )}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.forecastList}
          snapToInterval={CARD_WIDTH + CARD_GAP}
          decelerationRate="fast"
        />

        <View style={{ height: 48 }} />
      </ScrollView>

      {/* ─── LOCATION MODAL ──────────────────────────────────────────────── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="none"
        onRequestClose={closeModal}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeModal}>
          <Animated.View
            style={[
              styles.modalSheet,
              { transform: [{ translateY: modalTranslateY }] },
            ]}
          >
            <Pressable onPress={() => {}}>

              {/* Handle bar */}
              <View style={styles.sheetHandle} />

              {/* Title row */}
              <View style={styles.sheetTitleRow}>
                <Text style={styles.sheetTitle}>Change Location</Text>
                <TouchableOpacity onPress={closeModal} style={styles.closeBtn}>
                  <X size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.sheetSubtitle}>
                Choose how to set your weather location
              </Text>

              {/* ── Option 1: GPS ── */}
              <TouchableOpacity
                style={styles.gpsOption}
                onPress={handleUseGPS}
                activeOpacity={0.85}
              >
                <View style={styles.gpsIconBox}>
                  <Navigation size={22} color="#FFF" />
                </View>
                <View style={styles.gpsTextBlock}>
                  <Text style={styles.gpsOptionTitle}>Use Current Location</Text>
                  <Text style={styles.gpsOptionSub}>Auto-detect via GPS</Text>
                </View>
                <View style={styles.gpsArrow}>
                  <ChevronDown size={16} color={COLORS.primary} style={{ transform: [{ rotate: '-90deg' }] }} />
                </View>
              </TouchableOpacity>

              {/* ── Divider ── */}
              <View style={styles.orRow}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>or search manually</Text>
                <View style={styles.orLine} />
              </View>

              {/* ── City search input ── */}
              <View style={[styles.searchBox, cityError ? styles.searchBoxError : null]}>
                <Search size={18} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Type any city, town or village…"
                  placeholderTextColor="#BDBDBD"
                  value={cityInput}
                  onChangeText={(t) => { setCityInput(t); setCityError(''); }}
                  returnKeyType="search"
                  onSubmitEditing={() => handleCitySearch(cityInput)}
                  autoCorrect={false}
                  autoCapitalize="words"
                />
                {suggestionsLoading ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : !!cityInput ? (
                  <TouchableOpacity onPress={() => { setCityInput(''); setSuggestions([]); }}>
                    <X size={16} color="#BDBDBD" />
                  </TouchableOpacity>
                ) : null}
              </View>

              {!!cityError && (
                <Text style={styles.cityError}>{cityError}</Text>
              )}

              {/* ── Inline autocomplete suggestions ── */}
              {suggestions.length > 0 && (
                <View style={styles.suggestionsBox}>
                  {suggestions.map((sug, idx) => (
                    <TouchableOpacity
                      key={`${sug.city}-${idx}`}
                      style={[styles.suggestionRow, idx < suggestions.length - 1 && styles.suggestionBorder]}
                      onPress={() => handleSuggestionTap(sug)}
                      activeOpacity={0.7}
                    >
                      <MapPin size={14} color={COLORS.primary} style={{ marginRight: 8 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.suggestionCity}>{sug.city}</Text>
                        {!!sug.state && (
                          <Text style={styles.suggestionState}>{sug.state}</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* ── Quick city chips (hidden while suggestions are showing) ── */}
              {suggestions.length === 0 && (
                <>
                  <Text style={styles.quickLabel}>Popular cities</Text>
                  <View style={styles.quickChips}>
                    {QUICK_CITIES.map((c) => (
                      <TouchableOpacity
                        key={c}
                        style={styles.quickChip}
                        onPress={() => handleCitySearch(c)}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.quickChipText}>{c}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* ── Search button ── */}
              <TouchableOpacity
                style={[styles.searchBtn, (!cityInput.trim() || citySearching) && styles.searchBtnDisabled]}
                onPress={() => handleCitySearch(cityInput)}
                disabled={!cityInput.trim() || citySearching}
                activeOpacity={0.85}
              >
                {citySearching ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Search size={17} color="#FFF" />
                    <Text style={styles.searchBtnText}>Search Weather</Text>
                  </>
                )}
              </TouchableOpacity>

            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

// ─── Forecast Card (extracted for cleaner code) ───────────────────────────────

function ForecastCard({ item, index }: { item: WeatherData; index: number }) {
  const parts = (item.date || '').split(' ');
  const day = parts[0] || '';
  const dateLabel = parts.slice(1).join(' ');
  const isToday = index === 0;
  const rain = item.rainProbability ?? 0;
  const rainColor = rain >= 60 ? '#1565C0' : rain >= 30 ? '#1E88E5' : '#90CAF9';

  return (
    <View style={fcStyles.wrapper}>
      {isToday && (
        <View style={fcStyles.todayBadge}>
          <Text style={fcStyles.todayBadgeText}>TODAY</Text>
        </View>
      )}
      <View style={[fcStyles.card, isToday && fcStyles.cardToday]}>
        <Text style={[fcStyles.day, isToday && fcStyles.todayAccent]}>{day}</Text>
        <Text style={[fcStyles.dateLabel, isToday && fcStyles.todayAccent]}>{dateLabel}</Text>
        <Image
          source={{ uri: `https://openweathermap.org/img/wn/${item.icon}@2x.png` }}
          style={fcStyles.icon}
        />
        <Text style={[fcStyles.temp, isToday && fcStyles.todayAccent]}>{item.temp}°</Text>
        <Text style={fcStyles.cond} numberOfLines={1}>{item.condition}</Text>
        <View style={fcStyles.rainRow}>
          <Droplets size={11} color={rainColor} />
          <Text style={[fcStyles.rainPct, { color: rainColor }]}>{rain}%</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EEF2F5',
  },

  // Header
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EDF2',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: 0.2,
  },

  // Loading / error
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 36,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  loadingIconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
    textAlign: 'center',
  },
  loadingSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 22,
    gap: 8,
  },
  retryBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },

  // ── Weather Card ────────────────────────────────────────────────────────
  weatherCard: {
    backgroundColor: '#1B5E20',
    margin: 16,
    marginBottom: 8,
    borderRadius: 28,
    padding: 24,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  // Decorative background circles
  decCircle1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.05)',
    top: -60,
    right: -40,
  },
  decCircle2: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.04)',
    bottom: -30,
    left: -20,
  },

  deniedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 14,
    gap: 5,
  },
  deniedPillText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.88)',
  },

  // Top row
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignSelf: 'flex-start',
    marginRight: 10,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    flex: 1,
  },
  condBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  condBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.3,
  },

  // Date
  dateText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 18,
    marginTop: 4,
    marginLeft: 4,
  },

  // Temp + icon row
  tempIconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  tempValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tempNumber: {
    fontSize: 88,
    fontWeight: '800',
    color: '#FFF',
    lineHeight: 96,
    letterSpacing: -2,
  },
  tempUnit: {
    fontSize: 28,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
    marginTop: 16,
  },
  descriptionText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    fontStyle: 'italic',
    marginTop: 4,
    marginLeft: 2,
  },
  weatherIcon: {
    width: 110,
    height: 110,
    marginBottom: 8,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 18,
    padding: 16,
    marginTop: 16,
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  statLbl: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 44,
    backgroundColor: '#E8E8E8',
  },

  // Forecast section
  forecastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  forecastHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  forecastTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 1.2,
  },
  forecastSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  forecastList: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 20,
    paddingBottom: 4,
  },

  // ── Modal styles ──────────────────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#DDD',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 20,
  },

  // GPS option
  gpsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FAF0',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#C8E6C9',
    marginBottom: 20,
  },
  gpsIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  gpsTextBlock: {
    flex: 1,
  },
  gpsOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  gpsOptionSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  gpsArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // OR divider
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#EBEBEB',
  },
  orText: {
    fontSize: 12,
    color: '#AAAAAA',
    fontWeight: '500',
  },

  // Search box
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F9FC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E0E6EE',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  searchBoxError: {
    borderColor: COLORS.error,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
  },
  cityError: {
    fontSize: 12,
    color: COLORS.error,
    marginBottom: 12,
    marginLeft: 4,
  },

  // Autocomplete suggestions
  suggestionsBox: {
    backgroundColor: '#FAFAFA',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E0E6EE',
    marginBottom: 16,
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  suggestionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  suggestionCity: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  suggestionState: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },

  // Quick chips
  quickLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  quickChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  quickChip: {
    backgroundColor: '#F0FAF0',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  quickChipText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },

  // Search button
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 15,
    gap: 10,
    elevation: 3,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  searchBtnDisabled: {
    backgroundColor: '#BDBDBD',
    elevation: 0,
    shadowOpacity: 0,
  },
  searchBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

// ─── Forecast card styles ─────────────────────────────────────────────────────

const fcStyles = StyleSheet.create({
  wrapper: {
    marginRight: CARD_GAP,
    position: 'relative',
  },
  todayBadge: {
    position: 'absolute',
    top: -2,
    zIndex: 10,
    alignSelf: 'center',
    backgroundColor: '#1B5E20',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
    elevation: 6,
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 4,
  },
  todayBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  card: {
    width: CARD_WIDTH,
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 14,
    paddingHorizontal: 10,
    backgroundColor: '#FFF',
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
  },
  cardToday: {
    backgroundColor: '#E8F5E9',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  day: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 2,
  },
  dateLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 4,
    textAlign: 'center',
  },
  todayAccent: {
    color: COLORS.primary,
  },
  icon: {
    width: 48,
    height: 48,
    marginVertical: 4,
  },
  temp: {
    fontSize: 24,
    fontWeight: '800',
    color: '#222',
    marginBottom: 2,
  },
  cond: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 8,
  },
  rainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 7,
    gap: 4,
  },
  rainPct: {
    fontSize: 12,
    fontWeight: '700',
  },
});

// ─── SymptomsView (unchanged) ─────────────────────────────────────────────────

export const SymptomsView = () => (
  <View style={styles.centeredContainer}>
    <Text>Crop Advisory Content</Text>
  </View>
);
