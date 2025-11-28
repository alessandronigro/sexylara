const { supabase } = require('../lib/supabase');
const { v4: uuidv4 } = require('uuid');

/**
 * Supabase Storage Manager
 * Gestisce l'upload e il download di tutti i media su Supabase Storage
 */
class SupabaseStorageService {
    constructor() {
        this.buckets = {
            avatars: 'avatars',           // Foto profilo degli npc
            chatImages: 'chat-images',    // Immagini generate nelle chat
            chatVideos: 'chat-videos',    // Video generati nelle chat
            chatAudio: 'chat-audio',      // Audio generati nelle chat
            voiceMasters: 'voice-masters' // File master per clonazione vocale
        };
    }

    /**
     * Inizializza i bucket se non esistono
     */
    async initializeBuckets() {
        for (const [key, bucketName] of Object.entries(this.buckets)) {
            try {
                const { data, error } = await supabase.storage.getBucket(bucketName);

                if (error && error.message.includes('not found')) {
                    // Crea il bucket se non esiste
                    const { error: createError } = await supabase.storage.createBucket(bucketName, {
                        public: true,
                        fileSizeLimit: key === 'voiceMasters' ? 52428800 : 10485760, // 50MB per voice, 10MB per altri
                        allowedMimeTypes: this._getAllowedMimeTypes(key)
                    });

                    if (createError) {
                        console.error(`Errore creazione bucket ${bucketName}:`, createError);
                    } else {
                        console.log(`✅ Bucket ${bucketName} creato con successo`);
                    }
                }
            } catch (err) {
                console.error(`Errore inizializzazione bucket ${bucketName}:`, err);
            }
        }
    }

    _getAllowedMimeTypes(bucketKey) {
        const mimeTypes = {
            avatars: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
            chatImages: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
            chatVideos: ['video/mp4', 'video/webm', 'video/quicktime'],
            chatAudio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3'],
            voiceMasters: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3', 'audio/flac']
        };
        return mimeTypes[bucketKey] || [];
    }

    /**
     * Upload di un file da Buffer
     */
    async uploadFile(bucketName, buffer, options = {}) {
        const {
            filename = `${uuidv4()}.png`,
            contentType = 'image/png',
            upsert = true
        } = options;

        try {
            const { data, error } = await supabase.storage
                .from(bucketName)
                .upload(filename, buffer, {
                    contentType,
                    upsert
                });

            if (error) {
                console.error(`Errore upload su ${bucketName}:`, error);
                throw error;
            }

            // Ottieni URL pubblico
            const { data: { publicUrl } } = supabase.storage
                .from(bucketName)
                .getPublicUrl(filename);

            return {
                path: data.path,
                publicUrl,
                filename
            };
        } catch (error) {
            console.error('Errore upload file:', error);
            throw error;
        }
    }

    /**
     * Upload avatar girlfriend
     */
    async uploadAvatar(buffer, girlfriendId) {
        const filename = `girlfriend_${girlfriendId}_${Date.now()}.png`;
        return this.uploadFile(this.buckets.avatars, buffer, {
            filename,
            contentType: 'image/png'
        });
    }

    /**
     * Upload immagine chat
     */
    async uploadChatImage(buffer, userId, girlfriendId) {
        const filename = `${userId}/${girlfriendId}/${uuidv4()}.png`;
        return this.uploadFile(this.buckets.chatImages, buffer, {
            filename,
            contentType: 'image/png'
        });
    }

    /**
     * Upload video chat
     */
    async uploadChatVideo(buffer, userId, npcId) {
        const filename = `${userId}/${npcId}/${uuidv4()}.mp4`;
        return this.uploadFile(this.buckets.chatVideos, buffer, {
            filename,
            contentType: 'video/mp4'
        });
    }

    /**
     * Upload audio chat
     */
    async uploadChatAudio(buffer, userId, npcId) {
        const filename = `${userId}/${npcId}/${uuidv4()}.mp3`;
        return this.uploadFile(this.buckets.chatAudio, buffer, {
            filename,
            contentType: 'audio/mpeg'
        });
    }

    /**
     * Upload voice master per clonazione
     */
    async uploadVoiceMaster(buffer, npcId, originalFilename) {
        const ext = originalFilename.split('.').pop();
        const filename = `npc_${npcId}_master.${ext}`;
        return this.uploadFile(this.buckets.voiceMasters, buffer, {
            filename,
            contentType: this._getAudioMimeType(ext)
        });
    }

    _getAudioMimeType(ext) {
        const types = {
            mp3: 'audio/mpeg',
            wav: 'audio/wav',
            ogg: 'audio/ogg',
            flac: 'audio/flac'
        };
        return types[ext.toLowerCase()] || 'audio/mpeg';
    }

    /**
     * Elimina un file
     */
    async deleteFile(bucketName, filePath) {
        try {
            const { error } = await supabase.storage
                .from(bucketName)
                .remove([filePath]);

            if (error) {
                console.error(`Errore eliminazione file da ${bucketName}:`, error);
                throw error;
            }

            return true;
        } catch (error) {
            console.error('Errore eliminazione file:', error);
            throw error;
        }
    }

    /**
     * Elimina tutti i file di un npc
     */
    async deleteNpcFiles(girlfriendId) {
        const results = {
            avatar: false,
            voiceMaster: false,
            chatMedia: false
        };

        try {
            // Elimina avatar
            const { data: avatarFiles } = await supabase.storage
                .from(this.buckets.avatars)
                .list('', { search: `npc_${girlfriendId}` });

            if (avatarFiles && avatarFiles.length > 0) {
                await this.deleteFile(this.buckets.avatars, avatarFiles[0].name);
                results.avatar = true;
            }

            // Elimina voice master
            const { data: voiceFiles } = await supabase.storage
                .from(this.buckets.voiceMasters)
                .list('', { search: `npc_${girlfriendId}` });

            if (voiceFiles && voiceFiles.length > 0) {
                await this.deleteFile(this.buckets.voiceMasters, voiceFiles[0].name);
                results.voiceMaster = true;
            }

            // TODO: Elimina chat media se necessario
            results.chatMedia = true;

            return results;
        } catch (error) {
            console.error('Errore eliminazione file npc:', error);
            return results;
        }
    }

    /**
     * Ottieni URL pubblico di un file
     */
    getPublicUrl(bucketName, filePath) {
        const { data: { publicUrl } } = supabase.storage
            .from(bucketName)
            .getPublicUrl(filePath);
        return publicUrl;
    }

    /**
     * Download di un file come Buffer
     */
    async downloadFile(bucketName, filePath) {
        try {
            const { data, error } = await supabase.storage
                .from(bucketName)
                .download(filePath);

            if (error) {
                console.error(`Errore download da ${bucketName}:`, error);
                throw error;
            }

            return Buffer.from(await data.arrayBuffer());
        } catch (error) {
            console.error('Errore download file:', error);
            throw error;
        }
    }
}

// Singleton instance
const storageService = new SupabaseStorageService();

module.exports = storageService;
