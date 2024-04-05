import { IEventTicketType } from "Models/EventTicketTypeModel";
import { Model } from "mongoose";

export class EventTicketTypeService {
    constructor(public eventTicketTypeModel: Model<IEventTicketType>) {}

    async getAllEventTicketTypes(): Promise<IEventTicketType[] | null> {
        return this.eventTicketTypeModel.find();
    }

    async createEventTicketType({
        name,
        price,
        noOfTickets,
    }: IEventTicketType): Promise<IEventTicketType> {
        return this.eventTicketTypeModel.create({
            name,
            price,
            noOfTickets,
        });
    }

    async getEventTicketTypeById(
        eventTicketTypeId: string,
    ): Promise<IEventTicketType | null> {
        return this.eventTicketTypeModel.findById(eventTicketTypeId);
    }

    async updateEventTicketTypeById(
        eventTicketTypeId: string,
        eventTicketTypeUpdate: Partial<IEventTicketType>,
    ): Promise<IEventTicketType | null> {
        return this.eventTicketTypeModel.findByIdAndUpdate(
            eventTicketTypeId,
            eventTicketTypeUpdate,
            { new: true },
        );
    }

    async deleteEventTicketTypeById(eventTicketTypeId: string): Promise<null> {
        return this.eventTicketTypeModel.findByIdAndDelete(eventTicketTypeId);
    }
}
