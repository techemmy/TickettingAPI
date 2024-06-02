import { Request, Response } from "express";
import { EventModel, IEvent } from "../Models/EventModel";
import { EventService } from "../Services/EventService";
import { matchedData, validationResult } from "express-validator";
import { IUser } from "../Models/UserModel";
import {
    IAuthenticatedRequest,
    IEventPaginationAndSortReq,
} from "../Types/RequestTypes";
import { UserRole } from "../Enums/UserRole";
import { EventCategory } from "../Enums/EventCategory";
import { EventTicketTypeService } from "../Services/EventTicketTypeService";
import { EventTicketTypeModel } from "../Models/EventTicketTypeModel";
import { TicketService } from "../Services/TicketService";
import { TicketModel } from "../Models/TicketModel";
import cloudinary from "../Config/cloudinaryConfig";
import { EventStatus } from "../Enums/EventStatus";

export class EventController {
    private eventService: EventService;
    private eventTicketTypeService: EventTicketTypeService;
    private ticketService: TicketService;
    constructor() {
        this.eventService = new EventService(EventModel);
        this.eventTicketTypeService = new EventTicketTypeService(
            EventTicketTypeModel,
        );
        this.ticketService = new TicketService(TicketModel);
    }

    public getCategories = async (req: Request, res: Response) => {
        try {
            return res
                .status(200)
                .json({ eventCategories: Object.keys(EventCategory) });
        } catch (error) {
            return res.status(500).json(error);
        }
    };

    public getAllEvents = async (
        req: Request & IEventPaginationAndSortReq,
        res: Response,
    ): Promise<Response<IEvent[] | []>> => {
        try {
            const page = parseInt(req.query.page) || 1;
            const perPage = parseInt(req.query.perPage) || 9;
            const { sort, order } = req.query;
            const { organizerId } = req.params;

            const events = await this.eventService.getAllEvents({
                sort,
                order,
                page,
                perPage,
                organizerId,
            });

            const totalNoOfPages = Math.ceil(events.length / perPage);
            return res
                .status(200)
                .json({ page, perPage, totalNoOfPages, events });
        } catch (error) {
            return res.status(500).json(error);
        }
    };

    public getOrganizerEvents = async (
        req: IAuthenticatedRequest<IUser> & IEventPaginationAndSortReq,
        res: Response,
    ): Promise<Response<IEvent[] | []>> => {
        try {
            const page = parseInt(req.query.page) || 1;
            const perPage = parseInt(req.query.perPage) || 9;
            const { sort, order } = req.query;

            const events = await this.eventService.getAllEvents({
                status: Object.values(EventStatus),
                sort,
                order,
                page,
                perPage,
                organizerId: req.user._id.toString(),
                fieldsToSelect:
                    "id name location startDate endDate media status",
            });

            const eventWithTicketDetails = events.map(async (event) => {
                const { totalTickets, totalTicketsSold } =
                    await this.ticketService.getTicketSalesDetailsForEvent(
                        event.id,
                    );

                const availableTickets =
                    totalTickets - totalTicketsSold >= 0
                        ? totalTickets - totalTicketsSold
                        : 0;
                return {
                    ...event.toJSON(),
                    totalTickets,
                    totalTicketsSold,
                    availableTickets,
                };
            });

            const totalNoOfPages = Math.ceil(events.length / perPage);
            return res.status(200).json({
                page,
                perPage,
                totalNoOfPages,
                events: await Promise.all(eventWithTicketDetails),
            });
        } catch (error) {
            return res.status(500).json(error);
        }
    };

    public createEvent = async (
        req: IAuthenticatedRequest<IUser>,
        res: Response,
    ): Promise<Response<IEvent>> => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const data = matchedData(req);
            const { ticketTypes, ...eventData } = data;
            eventData.organizerId = req.user._id;

            const newEvent = this.eventService.createEvent(eventData as IEvent);
            // TODO: look into maximum file constraint
            const { url: bannerURL } = await cloudinary.uploader.upload(
                `${eventData.media.bannerImage}`,
                {
                    public_id: `${newEvent.id}`,
                    resource_type: "image",
                    folder: "teeket/event-image/banner/",
                },
            );
            const { url: mobilePreviewURL } = await cloudinary.uploader.upload(
                `${eventData.media.mobilePreviewImage}`,
                {
                    public_id: `${newEvent.id}`,
                    resource_type: "image",
                    folder: "teeket/event-image/mobile/",
                },
            );
            newEvent.media.bannerImageURL = bannerURL;
            newEvent.media.mobilePreviewImageURL = mobilePreviewURL;
            newEvent.save();

            await this.eventTicketTypeService.createEventTicketTypes(
                ticketTypes,
                newEvent._id,
            );
            return res.status(201).json({ event: newEvent });
        } catch (error) {
            res.status(500).json(error);
        }
    };

    public getEventById = async (
        req: Request,
        res: Response,
    ): Promise<Response<IEvent | null>> => {
        try {
            const eventId = req.params.eventId;
            const event = await this.eventService.getEventById(eventId);
            if (event == null) {
                return res.status(404).json({ error: "Event does not exists" });
            }
            return res.status(200).json(event);
        } catch (error) {
            return res.status(500).json(error);
        }
    };

    public getEventDetailsById = async (
        req: IAuthenticatedRequest<IUser>,
        res: Response,
    ): Promise<Response<IEvent | null>> => {
        try {
            const eventId = req.params.eventId;

            const event = await this.eventService.getEventById(eventId);
            if (event == null) {
                return res.status(404).json({ error: "Event does not exists" });
            }

            const organizerId = event?.organizerId?.toString();
            if (
                organizerId !== req.user._id.toString() ||
                req.user.role === UserRole.Admin
            ) {
                return res.status(403).json({
                    error: "Only the event organizers and admins can access this endpoint",
                });
            }

            const ticketTypes =
                await this.eventTicketTypeService.getTicketTypesByEventId(
                    eventId,
                );

            const totalRevenue = ticketTypes.reduce(
                (total, currentTicketType) => {
                    return (
                        total +
                        currentTicketType.price * currentTicketType.quantity
                    );
                },
                0,
            );

            const { salesByTicketType, totalTicketsSold, totalTickets } =
                await this.ticketService.getTicketSalesDetailsForEvent(eventId);

            return res.status(200).json({
                event: event.toJSON(),
                ticketTypes,
                totalRevenue,
                totalTicketsSold,
                totalTickets,
                salesByTicketType,
            });
        } catch (error) {
            return res.status(500).json(error);
        }
    };

    public updateEventById = async (
        req: IAuthenticatedRequest<IUser>,
        res: Response,
    ): Promise<Response<Event | null>> => {
        try {
            const eventId = req.params.eventId;

            const event = await this.eventService.getEventById(eventId);
            if (event == null) {
                return res.status(404).json({ error: "Event does not exists" });
            }

            if (
                req.user.id !== event.organizerId ||
                req.user.role !== UserRole.Admin
            ) {
                return res.status(403).json({
                    error: "Only the event organizers and admins can update the event",
                });
            }

            const eventUpdate = req.body;
            const updatedEvent = await this.eventService.updateEventById(
                eventId,
                eventUpdate,
            );
            return res.status(200).json({ event: updatedEvent });
        } catch (error) {
            return res.status(500).json(error);
        }
    };

    public deleteEventById = async (
        req: Request,
        res: Response,
    ): Promise<Response<null>> => {
        try {
            const eventId = req.params.eventId;
            const event = await this.eventService.getEventById(eventId);
            if (event == null) {
                return res.status(404).json({ error: "Event does not exists" });
            }
            await this.eventService.deleteEventById(eventId);
            return res.status(204).json();
        } catch (error) {
            return res.status(500).json(error);
        }
    };
}
