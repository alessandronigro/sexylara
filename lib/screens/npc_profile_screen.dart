import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../models/npc.dart';
import '../services/npc_service.dart';
import '../services/npc_feed_service.dart';
import '../widgets/npc_avatar.dart';

class NpcProfileScreen extends StatefulWidget {
  final String npcId;

  const NpcProfileScreen({
    super.key,
    required this.npcId,
  });

  @override
  State<NpcProfileScreen> createState() => _NpcProfileScreenState();
}

class _NpcProfileScreenState extends State<NpcProfileScreen> {
  final _npcService = NpcService();
  Npc? _npc;
  bool _loading = true;
  bool _regeneratingAvatar = false;

  @override
  void initState() {
    super.initState();
    _loadNpc();
  }

  Future<void> _loadNpc() async {
    setState(() => _loading = true);
    try {
      final npc = await _npcService.getNpcById(widget.npcId);
      setState(() {
        _npc = npc;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Errore caricamento profilo: $e')),
        );
      }
    }
  }

  Future<void> _regenerateAvatar() async {
    if (_npc == null) return;

    setState(() => _regeneratingAvatar = true);
    
    try {
      final characteristics = {
        'age': _npc!.age,
        'ethnicity': _npc!.ethnicity,
        'bodyType': _npc!.bodyType,
        'hairLength': _npc!.hairLength,
        'hairColor': _npc!.hairColor,
        'eyeColor': _npc!.eyeColor,
        'personalityType': _npc!.personalityType,
        'npcId': _npc!.id,
      };
      
      final newAvatarUrl = await _npcService.generateAvatar(characteristics);
      
      // Aggiorna la npc con il nuovo avatar
      final updatedNpc = _npc!.copyWith(avatarUrl: newAvatarUrl);
      await _npcService.updateNpc(updatedNpc);
      
      setState(() {
        _npc = updatedNpc;
        _regeneratingAvatar = false;
      });
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Avatar rigenerato con successo! ✨')),
        );
      }
    } catch (e) {
      setState(() => _regeneratingAvatar = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Errore rigenerazione avatar: $e')),
        );
      }
    }
  }

  Future<void> _publishToFeed() async {
    if (_npc == null) return;

    final TextEditingController messageController = TextEditingController();
    
    // Messaggio di default basato sulla personalità
    String defaultMessage = "Ciao a tutti! Sono ${_npc!.name}, piacere di conoscervi! ✨";
    messageController.text = defaultMessage;

    final shouldPublish = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A1A),
        title: const Text('Pubblica nel Feed', style: TextStyle(color: Colors.white)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Presenta la tua AI alla community!',
              style: TextStyle(color: Colors.white70),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: messageController,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(
                labelText: 'Messaggio di presentazione',
                labelStyle: TextStyle(color: Colors.pinkAccent),
                enabledBorder: OutlineInputBorder(
                  borderSide: BorderSide(color: Colors.grey),
                ),
                focusedBorder: OutlineInputBorder(
                  borderSide: BorderSide(color: Colors.pinkAccent),
                ),
              ),
              maxLines: 3,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Annulla'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.pinkAccent,
              foregroundColor: Colors.white,
            ),
            child: const Text('Pubblica'),
          ),
        ],
      ),
    );

    if (shouldPublish != true) return;

    try {
      await NpcFeedService.publishNpc(
        npcId: _npc!.id,
        message: messageController.text,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Pubblicata nel feed con successo! 🎉'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Errore pubblicazione: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _deleteNpc() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A1A),
        title: const Text('Elimina Npc', style: TextStyle(color: Colors.white)),
        content: Text(
          'Sei sicuro di voler eliminare ${_npc?.name}?\n\nQuesta azione eliminerà:\n• Il profilo\n• Tutti i messaggi\n• Tutte le foto generate\n• L\'avatar\n\nQuesta azione è irreversibile.',
          style: const TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Annulla'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Elimina'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    try {
      await _npcService.deleteNpc(widget.npcId);
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Npc eliminata')),
        );
        context.go('/'); // Torna alla home
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Errore eliminazione: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A1A1A),
        title: Text(_npc?.name ?? 'Profilo'),
        actions: [
          IconButton(
            icon: const Icon(Icons.delete_outline, color: Colors.red),
            onPressed: _deleteNpc,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Colors.pinkAccent))
          : _npc == null
              ? const Center(child: Text('Npc non trovata', style: TextStyle(color: Colors.white)))
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    children: [
                      // Avatar con pulsante rigenera
                      Stack(
                        alignment: Alignment.center,
                        children: [
                          NpcAvatar(
                            npc: _npc,
                            radius: 80,
                          ),
                          if (_regeneratingAvatar)
                            Container(
                              width: 160,
                              height: 160,
                              decoration: BoxDecoration(
                                color: Colors.black54,
                                shape: BoxShape.circle,
                              ),
                              child: const Center(
                                child: CircularProgressIndicator(color: Colors.pinkAccent),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      
                      // Pulsante rigenera avatar
                      OutlinedButton.icon(
                        onPressed: _regeneratingAvatar ? null : _regenerateAvatar,
                        icon: const Icon(Icons.refresh),
                        label: Text(_regeneratingAvatar ? 'Generando...' : 'Rigenera Foto Profilo'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.pinkAccent,
                          side: const BorderSide(color: Colors.pinkAccent),
                        ),
                      ),
                      
                      const SizedBox(height: 16),

                      // Pulsante Pubblica nel Feed
                      ElevatedButton.icon(
                        onPressed: _publishToFeed,
                        icon: const Icon(Icons.public),
                        label: const Text('Pubblica nel Feed Social'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.deepPurple,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                        ),
                      ),
                      
                      const SizedBox(height: 32),
                      
                      // Informazioni
                      _buildInfoCard(),
                      
                      const SizedBox(height: 16),
                      
                      // Statistiche
                      _buildStatsCard(),
                      
                      const SizedBox(height: 32),
                      
                      // Pulsante elimina
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          onPressed: _deleteNpc,
                          icon: const Icon(Icons.delete_forever),
                          label: const Text('Elimina Npc'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.red,
                            side: const BorderSide(color: Colors.red),
                            padding: const EdgeInsets.symmetric(vertical: 16),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
    );
  }

  Widget _buildInfoCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Informazioni',
            style: TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          _buildInfoRow('Nome', _npc!.name),
          _buildInfoRow('Età', '${_npc!.age} anni'),
          if (_npc!.ethnicity != null)
            _buildInfoRow('Etnia', _npc!.ethnicity!),
          if (_npc!.bodyType != null)
            _buildInfoRow('Corpo', _npc!.bodyType!),
          if (_npc!.hairLength != null && _npc!.hairColor != null)
            _buildInfoRow('Capelli', '${_npc!.hairLength} ${_npc!.hairColor}'),
          if (_npc!.eyeColor != null)
            _buildInfoRow('Occhi', _npc!.eyeColor!),
          if (_npc!.heightCm != null)
            _buildInfoRow('Altezza', '${_npc!.heightCm} cm'),
          if (_npc!.personalityType != null)
            _buildInfoRow('Personalità', _npc!.personalityType!),
          _buildInfoRow('Tono', _getToneName(_npc!.tone)),
        ],
      ),
    );
  }

  Widget _buildStatsCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Statistiche',
            style: TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildStatItem(Icons.message, 'Messaggi', '0'), // TODO: Implementa conteggio
              _buildStatItem(Icons.photo, 'Foto', '0'), // TODO: Implementa conteggio
              _buildStatItem(Icons.favorite, 'Preferita', 'No'), // TODO: Implementa preferiti
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem(IconData icon, String label, String value) {
    return Column(
      children: [
        Icon(icon, color: Colors.pinkAccent, size: 32),
        const SizedBox(height: 8),
        Text(
          value,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 20,
            fontWeight: FontWeight.bold,
          ),
        ),
        Text(
          label,
          style: TextStyle(
            color: Colors.grey[600],
            fontSize: 12,
          ),
        ),
      ],
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(color: Colors.grey[400], fontSize: 14),
          ),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  String _getToneName(String tone) {
    switch (tone) {
      case 'friendly':
        return 'Amichevole';
      case 'flirty':
        return 'Civettuola';
      case 'romantic':
        return 'Romantica';
      case 'explicit':
        return 'Esplicita';
      default:
        return tone;
    }
  }
}
