import 'package:supabase_flutter/supabase_flutter.dart' as supabase;
import 'package:google_sign_in/google_sign_in.dart' as google;

class SupabaseService {
  SupabaseService._();
  static final SupabaseService instance = SupabaseService._();

  static supabase.SupabaseClient get client => supabase.Supabase.instance.client;
  static supabase.User? get currentUser => client.auth.currentUser;

  static Future<void> initialize() async {
    const supabaseUrl = String.fromEnvironment('SUPABASE_URL', defaultValue: '');
    const supabaseKey = String.fromEnvironment('SUPABASE_ANON_KEY', defaultValue: '');

    if (supabaseUrl.isEmpty || supabaseKey.isEmpty) {
      throw StateError('Supabase credentials must be provided via --dart-define.');
    }

    await supabase.Supabase.initialize(
      url: supabaseUrl,
      anonKey: supabaseKey,
      debug: true,
    );
  }

  Future<supabase.AuthResponse> signInWithEmail(String email, String password) async {
    return client.auth.signInWithPassword(email: email, password: password);
  }

  Future<void> signOut() async {
    await client.auth.signOut();
  }

  Future<void> updateTone(String userId, String tone) async {
    await client.from('user_profile').upsert({
      'id': userId,
      'tone': tone,
    });
  }

  Future<supabase.AuthResponse> signInWithGoogle() async {
    const webClientId = String.fromEnvironment('GOOGLE_WEB_CLIENT_ID');
    const androidClientId = String.fromEnvironment('GOOGLE_ANDROID_CLIENT_ID');

    if (webClientId.isEmpty) {
      throw StateError(
        'Per completare il login con Google serve il client ID web (GOOGLE_WEB_CLIENT_ID). '
        'Passa il valore corretto con `--dart-define=GOOGLE_WEB_CLIENT_ID=<id>` prima di avviare l\'app.',
      );
    }

    final google.GoogleSignIn googleSignIn = google.GoogleSignIn(
      clientId: androidClientId.isNotEmpty ? androidClientId : null,
      serverClientId: webClientId,
    );

    // Force account selection
    try {
      await googleSignIn.signOut();
      await googleSignIn.disconnect();
    } catch (_) {
      // Ignore errors if not signed in
    }

    final googleUser = await googleSignIn.signIn();
    final googleAuth = await googleUser?.authentication;
    final accessToken = googleAuth?.accessToken;
    final idToken = googleAuth?.idToken;

    if (accessToken == null || idToken == null) {
      throw StateError(
        'Google Sign-In non ha restituito access token o ID token. '
        'Verifica che i client OAuth configurati su Google Cloud corrispondano al bundle/package dell\'app '
        'e che il token venga richiesto con `GOOGLE_WEB_CLIENT_ID` / `GOOGLE_ANDROID_CLIENT_ID`.',
      );
    }

    return client.auth.signInWithIdToken(
      provider: supabase.Provider.google,
      idToken: idToken,
      accessToken: accessToken,
    );
  }
}
