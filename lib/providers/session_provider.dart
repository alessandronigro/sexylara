import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/supabase_service.dart';

class SessionState {
  final bool authenticated;
  final String? userId;

  const SessionState({required this.authenticated, this.userId});

  factory SessionState.initial() => const SessionState(authenticated: false);

  SessionState copyWith({bool? authenticated, String? userId}) =>
      SessionState(
        authenticated: authenticated ?? this.authenticated,
        userId: userId ?? this.userId,
      );
}

class SessionNotifier extends StateNotifier<SessionState> {
  SessionNotifier() : super(SessionState.initial()) {
    _syncWithSupabase();
    SupabaseService.client.auth.onAuthStateChange.listen((_) {
      _syncWithSupabase();
    });
  }

  Future<void> _syncWithSupabase() async {
    final user = SupabaseService.currentUser;
    state = SessionState(
      authenticated: user != null,
      userId: user?.id,
    );
  }

  Future<void> refresh() async => _syncWithSupabase();
}

final sessionProvider = StateNotifierProvider<SessionNotifier, SessionState>(
  (ref) => SessionNotifier(),
);
