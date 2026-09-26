import { PartialType } from '@nestjs/swagger';
import { CareerCreateDto } from './careers.dto';

export class CareerUpdateDto extends PartialType(CareerCreateDto, { skipNullProperties: false }) {}
