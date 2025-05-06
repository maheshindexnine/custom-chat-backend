export class CreateUserDto {
  readonly name: string;
  readonly email: string;
  readonly mobile: string;
  readonly vId: string;
  readonly storeIds: string[];
  readonly roles: string[];
  readonly status: string;
}

export class UpdateUserDto {
  readonly name: string;
  readonly email: string;
  readonly mobile: string;
  readonly vId: string;
  readonly storeIds: string[];
  readonly roles: string[];
  readonly status: string;
}