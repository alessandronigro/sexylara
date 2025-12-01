import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';

class PrivacySettingsScreen extends StatefulWidget {
  const PrivacySettingsScreen({Key? key}) : super(key: key);

  @override
  State<PrivacySettingsScreen> createState() => _PrivacySettingsScreenState();
}

class _PrivacySettingsScreenState extends State<PrivacySettingsScreen> {
  bool _showActivity = false;
  bool _shareUsageData = false;
  bool _receiveMarketing = false;

  @override
  void initState() {
    super.initState();
    _loadPreferences();
  }

  Future<void> _loadPreferences() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _showActivity = prefs.getBool('privacy_showActivity') ?? false;
      _shareUsageData = prefs.getBool('privacy_shareUsage') ?? false;
      _receiveMarketing = prefs.getBool('privacy_receiveMarketing') ?? false;
    });
  }

  Future<void> _savePreference(String key, bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(key, value);
  }

  Widget _buildSwitch({required String title, required String subtitle, required bool value, required Function(bool) onChanged}) {
    return SwitchListTile(
      activeColor: Colors.pinkAccent,
      title: Text(title, style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w500)),
      subtitle: Text(subtitle, style: GoogleFonts.inter(color: Colors.grey[400])),
      value: value,
      onChanged: (v) async {
        onChanged(v);
        await _savePreference(title, v);
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0A),
      appBar: AppBar(
        title: Text('Impostazioni Privacy', style: GoogleFonts.inter()),
        backgroundColor: const Color(0xFF1A1A1A),
      ),
      body: SingleChildScrollView(
        child: Container(
          margin: const EdgeInsets.all(16),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF1A1A1A),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            children: [
              _buildSwitch(
                title: 'Mostra attività',
                subtitle: 'Consenti agli altri di vedere la tua attività nel feed',
                value: _showActivity,
                onChanged: (v) => setState(() => _showActivity = v),
              ),
              _buildSwitch(
                title: 'Condividi dati di utilizzo',
                subtitle: 'Aiuta a migliorare il servizio inviando dati anonimi',
                value: _shareUsageData,
                onChanged: (v) => setState(() => _shareUsageData = v),
              ),
              _buildSwitch(
                title: 'Ricevi email di marketing',
                subtitle: 'Ricevi offerte e novità via email',
                value: _receiveMarketing,
                onChanged: (v) => setState(() => _receiveMarketing = v),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
