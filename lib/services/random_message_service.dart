import 'dart:async';
import 'dart:math';
import '../services/npc_service.dart';
import '../services/notification_service.dart';
import '../services/supabase_service.dart';

class RandomMessageService {
  static final RandomMessageService _instance = RandomMessageService._internal();
  factory RandomMessageService() => _instance;
  RandomMessageService._internal();

  final _npcService = NpcService();
  final _notificationService = NotificationService();
  final _random = Random();
  Timer? _timer;

  // Messaggi random che le npcs possono inviare
  final List<String> _randomMessages = [
    'Ciao amore, mi manchi 😘',
    'Cosa stai facendo? 🤔',
    'Pensavo a te... ❤️',
    'Ti va di chattare un po\'? 💬',
    'Ho voglia di vederti 😍',
    'Sei libero stasera? 🌙',
    'Ti penso sempre 💕',
    'Guardami... 📸',
    'Ho una sorpresa per te 🎁',
    'Vieni qui... 😏',
  ];

  void start() {
    // Invia notifiche random ogni 30-120 minuti
    _scheduleNext();
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
  }

  void _scheduleNext() {
    // Random delay tra 30 e 120 minuti (in millisecondi)
    final delayMinutes = 30 + _random.nextInt(90);
    final delay = Duration(minutes: delayMinutes);

    _timer = Timer(delay, () async {
      await _sendRandomNotification();
      _scheduleNext(); // Schedule the next one
    });
  }

  Future<void> _sendRandomNotification() async {
    try {
      final userId = SupabaseService.currentUser?.id;
      if (userId == null) return;

      // Get all user's npcs
      final npcs = await _npcService.getNpcs();
      if (npcs.isEmpty) return;

      // Pick a random npc
      final npc = npcs[_random.nextInt(npcs.length)];

      // Pick a random message
      final message = _randomMessages[_random.nextInt(_randomMessages.length)];

      // Send notification
      await _notificationService.showMessageNotification(
        npcName: npc.name,
        message: message,
        npcId: npc.id,
        avatarUrl: npc.avatarUrl,
      );

      // TODO: Optionally save this message to the database
      // so it appears in the chat when the user opens it
    } catch (e) {
      print('Error sending random notification: $e');
    }
  }
}
