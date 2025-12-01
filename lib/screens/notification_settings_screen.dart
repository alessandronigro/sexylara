import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';

class NotificationSettingsScreen extends StatefulWidget {
  const NotificationSettingsScreen({Key? key}) : super(key: key);

  @override
  State<NotificationSettingsScreen> createState() => _NotificationSettingsScreenState();
}

class _NotificationSettingsScreenState extends State<NotificationSettingsScreen> {
  bool _pushEnabled = false;

  @override
  void initState() {
    super.initState();
    _loadPreference();
  }

  Future<void> _loadPreference() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _pushEnabled = prefs.getBool('notifications_enabled') ?? false;
    });
  }

  Future<void> _savePreference(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('notifications_enabled', value);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0A),
      appBar: AppBar(
        title: Text('Gestione Notifiche', style: GoogleFonts.inter()),
        backgroundColor: const Color(0xFF1A1A1A),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: SwitchListTile(
          activeColor: Colors.pinkAccent,
          title: Text('Abilita notifiche push', style: GoogleFonts.inter(color: Colors.white)),
          subtitle: Text('Ricevi aggiornamenti in tempo reale', style: GoogleFonts.inter(color: Colors.grey[400])),
          value: _pushEnabled,
          onChanged: (v) async {
            setState(() => _pushEnabled = v);
            await _savePreference(v);
          },
        ),
      ),
    );
  }
}
