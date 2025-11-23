import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/session_provider.dart';
import '../services/supabase_service.dart';

const _categories = [
  {'name': 'Romantica', 'description': 'Dolce e passionale'},
  {'name': 'Aggressiva', 'description': 'Dominante e diretta'},
  {'name': 'Sensuale', 'description': 'Intensa e provocante'},
  {'name': 'Adultera', 'description': 'Trasgressiva e segreta'},
  {'name': 'Fetish', 'description': 'Tabù e desideri'},
  {'name': 'Bondage', 'description': 'Controllo e sottomissione'},
  {'name': 'Giocosa', 'description': 'Leggera e ironica'},
  {'name': 'Sottomessa', 'description': 'Obbediente e devota'},
  {'name': 'Misteriosa', 'description': 'Enigmatica e magnetica'},
  {'name': 'Ninfomane', 'description': 'Sempre desiderosa'},
];

class PreferenceScreen extends ConsumerStatefulWidget {
  const PreferenceScreen({super.key});

  @override
  ConsumerState<PreferenceScreen> createState() => _PreferenceScreenState();
}

class _PreferenceScreenState extends ConsumerState<PreferenceScreen> {
  bool _loading = false;

  Future<void> _savePreference(String tone) async {
    final userId = ref.read(sessionProvider).userId;
    if (userId == null) return;

    setState(() => _loading = true);
    try {
      await SupabaseService.instance.updateTone(userId, tone.toLowerCase());
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Preferenza salvata')));
      }
    } catch (error) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Errore: $error')));
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Preferenze')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: GridView.builder(
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.2,
          ),
          itemCount: _categories.length,
          itemBuilder: (context, index) {
            final category = _categories[index];
            return ElevatedButton(
              onPressed: _loading ? null : () => _savePreference(category['name']!),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.all(12),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(category['name']!, style: const TextStyle(fontSize: 18)),
                  const SizedBox(height: 6),
                  Text(
                    category['description']!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 12),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}
