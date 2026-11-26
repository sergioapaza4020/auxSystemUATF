import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { MoreThan, Repository } from 'typeorm';
import { avatarVersion } from '@common/utils/avatar-key';
import { User } from 'src/entities/users/users.entity';
import { UserSession } from 'src/entities/user-sessions/user-sessions.entity';
import { AVATAR_MAX_BYTES, AvatarStorage } from './avatar-storage.service';

const imageFormats: Readonly<Record<string, string>> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};
const pixelLimit = 4096 * 4096;

@Injectable()
export class ProfileAvatarService {
  private readonly logger = new Logger(ProfileAvatarService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly storage: AvatarStorage,
  ) {}

  async get(idUser: number) {
    const key = await this.currentKey(idUser, true);
    if (key && avatarVersion(idUser, key)) {
      const stream = await this.storage.get(key);
      if (stream) return stream;
      // A concurrent replacement can retire the object after the first database read.
      const latest = await this.currentKey(idUser, true);
      if (latest && latest !== key && avatarVersion(idUser, latest)) {
        const replacement = await this.storage.get(latest);
        if (replacement) return replacement;
      }
    }
    throw new NotFoundException('No hay una fotografía de perfil disponible.');
  }

  async replace(idUser: number, idSession: number, file?: Express.Multer.File) {
    if (!file?.buffer.length || file.buffer.length > AVATAR_MAX_BYTES) {
      throw new BadRequestException('Selecciona una imagen de hasta 2 MB.');
    }
    let optimized: Buffer;
    try {
      const image = sharp(file.buffer, { limitInputPixels: pixelLimit, failOn: 'warning' });
      const metadata = await image.metadata();
      if (
        !metadata.format ||
        imageFormats[metadata.format] !== file.mimetype ||
        !metadata.width ||
        !metadata.height ||
        metadata.width > 4096 ||
        metadata.height > 4096 ||
        (metadata.pages ?? 1) > 1
      ) {
        throw new Error('Unsupported avatar');
      }
      optimized = await image
        .rotate()
        .resize(256, 256, { fit: 'cover', position: 'centre' })
        .webp({ quality: 80, alphaQuality: 100 })
        .toBuffer();
    } catch {
      throw new BadRequestException(
        'Selecciona una imagen JPEG, PNG o WebP válida de hasta 4096 × 4096 px.',
      );
    }

    const version = randomUUID();
    const key = `avatars/${idUser}/${version}.webp`;
    try {
      await this.storage.put(key, optimized);
    } catch {
      // A timeout can occur after the remote write. Track this fresh key for reconciliation.
      this.pendingCleanup(key);
      throw new ServiceUnavailableException('No pudimos almacenar la fotografía.');
    }
    let previous: string | null;
    try {
      previous = await this.setKey(idUser, idSession, key);
    } catch (error) {
      try {
        // Protect the new object if commit succeeded but its acknowledgement was lost.
        if ((await this.currentKey(idUser, false)) !== key) await this.cleanup(key);
      } catch {
        this.pendingCleanup(key);
      }
      throw error;
    }
    if (previous && avatarVersion(idUser, previous)) await this.cleanup(previous);
    return { avatarVersion: avatarVersion(idUser, key) };
  }

  async remove(idUser: number, idSession: number) {
    const previous = await this.setKey(idUser, idSession, null);
    if (previous && avatarVersion(idUser, previous)) await this.cleanup(previous);
    return { avatarVersion: null };
  }

  private async currentKey(idUser: number, activeOnly: boolean) {
    const account = await this.users.findOne({
      where: { idUser, ...(activeOnly ? { isActive: true } : {}) },
      withDeleted: !activeOnly,
      select: { idUser: true, avatar: true },
    });
    return account?.avatar ?? null;
  }

  private setKey(idUser: number, idSession: number, key: string | null) {
    return this.users.manager.transaction(async (manager) => {
      const users = manager.getRepository(User);
      const user = await users.findOne({
        where: { idUser, isActive: true },
        select: { idUser: true, avatar: true },
        lock: { mode: 'pessimistic_write' },
      });
      const session = await manager.getRepository(UserSession).findOne({
        where: { idSession, user: { idUser }, isActive: true, expiresAt: MoreThan(new Date()) },
        select: { idSession: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user || !session) throw new UnauthorizedException('Tu sesión ya no está activa.');
      const previous = user.avatar ?? null;
      if (previous !== key) await users.update(idUser, { avatar: key, updatedBy: idUser });
      return previous;
    });
  }

  private async cleanup(key: string) {
    try {
      await this.storage.remove(key);
    } catch {
      this.pendingCleanup(key);
    }
  }

  private pendingCleanup(key: string) {
    this.logger.warn({ event: 'avatar_cleanup_pending', key });
  }
}
