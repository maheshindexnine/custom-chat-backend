import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Organization } from '../schemas/organization.schema';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from 'src/users/dto/create-user.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectModel(Organization.name)
    private organizationModel: Model<Organization>,
    @Inject(forwardRef(() => UsersService))
    private userService: UsersService,
  ) {}

  async create(
    createOrganizationDto: CreateOrganizationDto,
  ): Promise<Organization> {
    const payload = {
      name: createOrganizationDto.organizationName,
      description: createOrganizationDto.description,
      imageUrl: createOrganizationDto?.imageUrl,
    };
    const createdOrganization = new this.organizationModel(payload);
    if (createdOrganization?._id) {
      const userPayload = {
        name: createOrganizationDto.name,
        email: createOrganizationDto.email,
        password: createOrganizationDto.password,
        type: 'admin' as 'admin' | 'user' | 'vendor',
        age: createOrganizationDto.age,
        phone: createOrganizationDto.phone,
        organizationId: createdOrganization._id,
      };
      await this.userService.create(userPayload as CreateUserDto);
    }
    return createdOrganization.save();
  }

  async findAll(): Promise<Organization[]> {
    return this.organizationModel.find().exec();
  }

  async findOne(id: string): Promise<Organization> {
    const organization = await this.organizationModel.findById(id).exec();
    if (!organization) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }
    return organization;
  }

  async update(
    id: string,
    updateOrganizationDto: Partial<CreateOrganizationDto>,
  ): Promise<Organization> {
    const organization = await this.organizationModel
      .findByIdAndUpdate(id, updateOrganizationDto, { new: true })
      .exec();

    if (!organization) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }
    return organization;
  }

  async remove(id: string): Promise<Organization> {
    const organization = await this.organizationModel
      .findByIdAndDelete(id)
      .exec();
    if (!organization) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }
    return organization;
  }
}
